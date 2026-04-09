import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

interface CliOptions {
  playersSummaryPath: string;
  telemetryPath: string;
  outputPath: string;
}

interface SavePlayerEntry {
  path: string;
  playerFileName: string;
  playerSaveId: string;
  parsed?: {
    nickname?: string | null;
    playerUid?: string | null;
    stringHints?: string[];
  };
  parseStatus?: {
    status?: string;
    message?: string;
  };
}

interface PlayersSummaryArtifact {
  snapshotPath: string;
  generatedAt: string;
  worldId: string | null;
  playerFiles: SavePlayerEntry[];
}

interface TelemetryLatestPlayer {
  server_id?: string;
  lookup_key?: string;
  player_name?: string;
  account_name?: string;
  player_id?: string;
  user_id?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  is_online?: boolean;
}

interface TelemetryArtifact {
  latestPlayerStates?: TelemetryLatestPlayer[];
}

type Confidence = 'low' | 'medium' | 'high';

interface IdentityCandidateLink {
  serverId: string;
  savePlayerFileName: string;
  savePlayerSaveId: string;
  telemetryLookupKey: string | null;
  candidate: {
    playerId: string | null;
    userId: string | null;
    accountName: string | null;
    playerName: string | null;
  };
  confidence: Confidence;
  score: number;
  matchedOn: string[];
  notes: string[];
}

interface IdentityLinkFailure {
  savePlayerFileName: string;
  savePlayerSaveId: string;
  status: 'skipped' | 'no_match' | 'input_error';
  message: string;
}

interface IdentityReconcileArtifact {
  generatedAt: string;
  inputs: {
    playersSummaryPath: string;
    telemetryPath: string;
  };
  candidates: IdentityCandidateLink[];
  failures: IdentityLinkFailure[];
}

function usage(): never {
  console.error(
    'Usage: npm exec tsx scripts/palworld-identity-reconcile.ts --players-summary <players-summary.json> --telemetry <palworld-telemetry.json> --output <identity-links.json>'
  );
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  let playersSummaryPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH ?? '';
  let telemetryPath = process.env.PALWORLD_TELEMETRY_PATH ?? '';
  let outputPath = process.env.PALWORLD_IDENTITY_OUTPUT_PATH ?? '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--players-summary') {
      playersSummaryPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--telemetry') {
      telemetryPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--output') {
      outputPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
  }

  if (!playersSummaryPath || !telemetryPath || !outputPath) {
    usage();
  }

  return {
    playersSummaryPath: isAbsolute(playersSummaryPath) ? playersSummaryPath : resolve(process.cwd(), playersSummaryPath),
    telemetryPath: isAbsolute(telemetryPath) ? telemetryPath : resolve(process.cwd(), telemetryPath),
    outputPath: isAbsolute(outputPath) ? outputPath : resolve(process.cwd(), outputPath)
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCompact(value: string | null | undefined): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function addCandidateScore(
  input: {
    savePlayer: SavePlayerEntry;
    telemetryPlayer: TelemetryLatestPlayer;
  }
): { score: number; matchedOn: string[]; notes: string[] } {
  let score = 0;
  const matchedOn: string[] = [];
  const notes: string[] = [];

  const saveId = normalizeCompact(input.savePlayer.playerSaveId);
  const saveUid = normalizeCompact(input.savePlayer.parsed?.playerUid);
  const nickname = normalize(input.savePlayer.parsed?.nickname);
  const stringHints = (input.savePlayer.parsed?.stringHints ?? []).map((hint) => normalize(hint));

  const playerId = normalizeCompact(input.telemetryPlayer.player_id);
  const userId = normalizeCompact(input.telemetryPlayer.user_id);
  const accountName = normalize(input.telemetryPlayer.account_name);
  const playerName = normalize(input.telemetryPlayer.player_name);

  if (saveUid && userId && saveUid === userId) {
    score += 100;
    matchedOn.push('playerUid=userId');
  }

  if (saveUid && playerId && saveUid === playerId) {
    score += 100;
    matchedOn.push('playerUid=playerId');
  }

  if (saveId && playerId && saveId === playerId) {
    score += 85;
    matchedOn.push('playerSaveId=playerId');
  }

  if (saveId && userId && saveId === userId) {
    score += 80;
    matchedOn.push('playerSaveId=userId');
  }

  if (nickname && playerName && nickname === playerName) {
    score += 45;
    matchedOn.push('nickname=playerName');
  }

  if (nickname && accountName && nickname === accountName) {
    score += 35;
    matchedOn.push('nickname=accountName');
  }

  if (stringHints.length > 0) {
    if (playerName && stringHints.includes(playerName)) {
      score += 25;
      matchedOn.push('stringHints~playerName');
    }

    if (accountName && stringHints.includes(accountName)) {
      score += 20;
      matchedOn.push('stringHints~accountName');
    }
  }

  if (matchedOn.length === 0) {
    notes.push('no_high_confidence_overlap');
  }

  return { score, matchedOn, notes };
}

function scoreToConfidence(score: number): Confidence {
  if (score >= 90) {
    return 'high';
  }

  if (score >= 40) {
    return 'medium';
  }

  return 'low';
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const playersSummary = readJson<PlayersSummaryArtifact>(options.playersSummaryPath);
  const telemetry = readJson<TelemetryArtifact>(options.telemetryPath);
  const telemetryPlayers = telemetry.latestPlayerStates ?? [];

  const candidates: IdentityCandidateLink[] = [];
  const failures: IdentityLinkFailure[] = [];

  for (const savePlayer of playersSummary.playerFiles ?? []) {
    if (!savePlayer.playerFileName || !savePlayer.playerSaveId) {
      failures.push({
        savePlayerFileName: savePlayer.playerFileName ?? 'unknown',
        savePlayerSaveId: savePlayer.playerSaveId ?? 'unknown',
        status: 'input_error',
        message: 'missing_save_player_identifiers'
      });
      continue;
    }

    if (savePlayer.parseStatus?.status === 'parse_failed') {
      failures.push({
        savePlayerFileName: savePlayer.playerFileName,
        savePlayerSaveId: savePlayer.playerSaveId,
        status: 'skipped',
        message: `player_parse_failed:${savePlayer.parseStatus.message ?? 'unknown'}`
      });
      continue;
    }

    let bestMatch: IdentityCandidateLink | null = null;

    for (const telemetryPlayer of telemetryPlayers) {
      const scored = addCandidateScore({ savePlayer, telemetryPlayer });

      if (scored.score <= 0) {
        continue;
      }

      const candidate: IdentityCandidateLink = {
        serverId: telemetryPlayer.server_id ?? 'unknown',
        savePlayerFileName: savePlayer.playerFileName,
        savePlayerSaveId: savePlayer.playerSaveId,
        telemetryLookupKey: telemetryPlayer.lookup_key ?? null,
        candidate: {
          playerId: telemetryPlayer.player_id ?? null,
          userId: telemetryPlayer.user_id ?? null,
          accountName: telemetryPlayer.account_name ?? null,
          playerName: telemetryPlayer.player_name ?? null
        },
        confidence: scoreToConfidence(scored.score),
        score: scored.score,
        matchedOn: scored.matchedOn,
        notes: scored.notes
      };

      if (!bestMatch || candidate.score > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    if (!bestMatch) {
      failures.push({
        savePlayerFileName: savePlayer.playerFileName,
        savePlayerSaveId: savePlayer.playerSaveId,
        status: 'no_match',
        message: 'no_candidate_scored_above_zero'
      });
      continue;
    }

    candidates.push(bestMatch);
  }

  const artifact: IdentityReconcileArtifact = {
    generatedAt,
    inputs: {
      playersSummaryPath: options.playersSummaryPath,
      telemetryPath: options.telemetryPath
    },
    candidates: candidates.sort((left, right) => right.score - left.score),
    failures
  };

  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log('Palworld identity reconciliation completed');
  console.log(`  players-summary: ${options.playersSummaryPath}`);
  console.log(`  telemetry:       ${options.telemetryPath}`);
  console.log(`  output:          ${options.outputPath}`);
  console.log(`  candidates:      ${artifact.candidates.length}`);
  console.log(`  failures:        ${artifact.failures.length}`);
}

main();
