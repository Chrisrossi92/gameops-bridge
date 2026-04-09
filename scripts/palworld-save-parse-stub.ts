import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

interface CliOptions {
  snapshotPath: string;
  outputRoot: string;
  converterScriptPath: string | null;
  pythonBin: string;
}

interface FileFact {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  exists: boolean;
}

interface SnapshotManifest {
  snapshotPath: string;
  outputPath: string;
  generatedAt: string;
  worldId: string | null;
  files: {
    level: FileFact;
    levelMeta: FileFact;
    worldOption: FileFact | null;
    players: FileFact[];
  };
  validation: {
    hasSaveGamesRoot: boolean;
    hasWorldDirectory: boolean;
    hasLevelSav: boolean;
    hasLevelMetaSav: boolean;
    playerSaveCount: number;
    ok: boolean;
  };
}

interface WorldSummary {
  snapshotPath: string;
  generatedAt: string;
  worldId: string | null;
  worldFiles: {
    level: FileFact;
    levelMeta: FileFact;
    worldOption: FileFact | null;
  };
  parseStatus: {
    worldData: 'stub_not_parsed';
    worldMeta: 'stub_not_parsed';
    worldOptions: 'stub_not_parsed' | 'not_present';
  };
  decodedMetadata: {
    levelMeta: {
      nameHints: string[];
      guidHints: string[];
    };
    worldOption: {
      nameHints: string[];
      guidHints: string[];
    };
  };
  decodeMessages: {
    levelMeta: string;
    worldOption: string;
  };
}

interface PlayersSummary {
  snapshotPath: string;
  generatedAt: string;
  worldId: string | null;
  playerSaveCount: number;
  playerFiles: Array<FileFact & {
    playerFileName: string;
    playerSaveId: string;
    parsed: {
      nickname: string | null;
      playerUid: string | null;
      stringHints: string[];
    };
    parseStatus: {
      status: 'parsed' | 'stub_not_parsed' | 'parse_failed';
      decoder: 'palworld-save-tools' | 'none';
      message: string;
    };
  }>;
  parseStatus: {
    playerData: 'partially_parsed' | 'stub_not_parsed';
  };
}

function usage(): never {
  console.error(
    'Usage: npm exec tsx scripts/palworld-save-parse-stub.ts --snapshot-path <staged-save-root> --output-root <artifact-root>'
  );
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  let snapshotPath = process.env.PALWORLD_SNAPSHOT_PATH ?? '';
  let outputRoot = process.env.PALWORLD_PARSE_OUTPUT_ROOT ?? '';
  let converterScriptPath = process.env.PALWORLD_SAVE_CONVERT_PY ?? '';
  let pythonBin = process.env.PALWORLD_SAVE_PYTHON_BIN ?? 'python3';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--snapshot-path') {
      snapshotPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--output-root') {
      outputRoot = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--converter-script') {
      converterScriptPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--python-bin') {
      pythonBin = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
  }

  if (!snapshotPath || !outputRoot) {
    usage();
  }

  return {
    snapshotPath: isAbsolute(snapshotPath) ? snapshotPath : resolve(process.cwd(), snapshotPath),
    outputRoot: isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot),
    converterScriptPath: converterScriptPath
      ? (isAbsolute(converterScriptPath) ? converterScriptPath : resolve(process.cwd(), converterScriptPath))
      : null,
    pythonBin
  };
}

function toFileFact(path: string): FileFact {
  try {
    const stat = statSync(path);
    return {
      path,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      exists: true
    };
  } catch {
    return {
      path,
      sizeBytes: 0,
      modifiedAt: '',
      exists: false
    };
  }
}

function detectWorldDirectory(snapshotPath: string): { worldId: string | null; worldPath: string | null; hasSaveGamesRoot: boolean } {
  const saveGamesRoot = join(snapshotPath, 'SaveGames', '0');

  try {
    const entries = readdirSync(saveGamesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const worldId = entries[0] ?? null;

    return {
      worldId,
      worldPath: worldId ? join(saveGamesRoot, worldId) : null,
      hasSaveGamesRoot: true
    };
  } catch {
    return {
      worldId: null,
      worldPath: null,
      hasSaveGamesRoot: false
    };
  }
}

function getPlayerFiles(worldPath: string | null): Array<FileFact & { playerFileName: string; playerSaveId: string }> {
  if (!worldPath) {
    return [];
  }

  const playersRoot = join(worldPath, 'Players');

  try {
    return readdirSync(playersRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sav'))
      .map((entry) => {
        const path = join(playersRoot, entry.name);
        return {
          ...toFileFact(path),
          playerFileName: entry.name,
          playerSaveId: entry.name.replace(/\.sav$/i, '')
        };
      })
      .sort((left, right) => left.playerFileName.localeCompare(right.playerFileName));
  } catch {
    return [];
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isGuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-f]{32}$/i.test(value);
}

function collectMatchingStrings(
  value: unknown,
  matchers: string[],
  found: string[],
  currentKey = ''
): void {
  if (found.length >= 5) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMatchingStrings(item, matchers, found, currentKey);
      if (found.length >= 5) {
        return;
      }
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      collectMatchingStrings(nested, matchers, found, key);
      if (found.length >= 5) {
        return;
      }
    }
    return;
  }

  if (typeof value === 'string' && currentKey) {
    const normalizedKey = currentKey.toLowerCase();
    const shouldMatch = matchers.some((matcher) => normalizedKey.includes(matcher));

    if (shouldMatch && value.trim()) {
      found.push(value.trim());
    }
  }
}

function findFirstGuid(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findFirstGuid(item);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nested === 'string' && /(playeruid|player_uid|guid|uid)$/i.test(key) && isGuidLike(nested.trim())) {
        return nested.trim();
      }

      const nestedMatch = findFirstGuid(nested);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  return null;
}

function tryDecodeSavJson(
  savPath: string,
  outputPath: string,
  options: CliOptions
): { ok: boolean; jsonPath: string | null; message: string } {
  if (!options.converterScriptPath) {
    return { ok: false, jsonPath: null, message: 'converter_not_configured' };
  }

  if (!existsSync(options.converterScriptPath)) {
    return { ok: false, jsonPath: null, message: `converter_missing:${options.converterScriptPath}` };
  }

  const jsonPath = `${outputPath}.json`;
  const result = spawnSync(
    options.pythonBin,
    [
      options.converterScriptPath,
      savPath,
      '--to-json',
      '--output',
      jsonPath,
      '--force',
      '--minify-json'
    ],
    {
      encoding: 'utf8'
    }
  );

  if (result.status !== 0 || !existsSync(jsonPath)) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    return {
      ok: false,
      jsonPath: null,
      message: stderr || stdout || `converter_exit_${result.status ?? 'unknown'}`
    };
  }

  return {
    ok: true,
    jsonPath,
    message: 'parsed'
  };
}

function parsePlayerMetadata(
  savPath: string,
  outputDir: string,
  options: CliOptions
): {
  parsed: {
    nickname: string | null;
    playerUid: string | null;
    stringHints: string[];
  };
  parseStatus: {
    status: 'parsed' | 'stub_not_parsed' | 'parse_failed';
    decoder: 'palworld-save-tools' | 'none';
    message: string;
  };
} {
  const tempBase = join(outputDir, '_tmp', basename(savPath));
  const conversion = tryDecodeSavJson(savPath, tempBase, options);

  if (!conversion.ok || !conversion.jsonPath) {
    return {
      parsed: {
        nickname: null,
        playerUid: null,
        stringHints: []
      },
      parseStatus: {
        status: options.converterScriptPath ? 'parse_failed' : 'stub_not_parsed',
        decoder: options.converterScriptPath ? 'palworld-save-tools' : 'none',
        message: conversion.message
      }
    };
  }

  try {
    const jsonRoot = JSON.parse(readFileSync(conversion.jsonPath, 'utf8')) as unknown;
    const nameHints: string[] = [];
    collectMatchingStrings(jsonRoot, ['nickname', 'playername', 'name'], nameHints);
    const playerUid = findFirstGuid(jsonRoot);

    return {
      parsed: {
        nickname: nameHints[0] ?? null,
        playerUid,
        stringHints: nameHints.slice(0, 5)
      },
      parseStatus: {
        status: 'parsed',
        decoder: 'palworld-save-tools',
        message: 'parsed_from_converted_json'
      }
    };
  } catch (error) {
    return {
      parsed: {
        nickname: null,
        playerUid: null,
        stringHints: []
      },
      parseStatus: {
        status: 'parse_failed',
        decoder: 'palworld-save-tools',
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function parseWorldMetadata(
  savPath: string | null,
  outputDir: string,
  options: CliOptions
): {
  parseStatus: 'parsed' | 'stub_not_parsed' | 'parse_failed' | 'not_present';
  metadata: {
    nameHints: string[];
    guidHints: string[];
  };
  message: string;
} {
  if (!savPath) {
    return {
      parseStatus: 'not_present',
      metadata: { nameHints: [], guidHints: [] },
      message: 'file_not_present'
    };
  }

  const tempBase = join(outputDir, '_tmp', basename(savPath));
  const conversion = tryDecodeSavJson(savPath, tempBase, options);

  if (!conversion.ok || !conversion.jsonPath) {
    return {
      parseStatus: options.converterScriptPath ? 'parse_failed' : 'stub_not_parsed',
      metadata: { nameHints: [], guidHints: [] },
      message: conversion.message
    };
  }

  try {
    const jsonRoot = JSON.parse(readFileSync(conversion.jsonPath, 'utf8')) as unknown;
    const nameHints: string[] = [];
    const guidHints: string[] = [];
    collectMatchingStrings(jsonRoot, ['worldname', 'sessionname', 'servername', 'dedicatedservername'], nameHints);
    collectMatchingStrings(jsonRoot, ['guid', 'uid'], guidHints);

    return {
      parseStatus: 'parsed',
      metadata: {
        nameHints: nameHints.slice(0, 5),
        guidHints: guidHints.filter((value) => isGuidLike(value)).slice(0, 5)
      },
      message: 'parsed_from_converted_json'
    };
  } catch (error) {
    return {
      parseStatus: 'parse_failed',
      metadata: { nameHints: [], guidHints: [] },
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const detected = detectWorldDirectory(options.snapshotPath);
  const worldPath = detected.worldPath;
  const levelPath = worldPath ? join(worldPath, 'Level.sav') : join(options.snapshotPath, 'SaveGames', '0', '<world-id>', 'Level.sav');
  const levelMetaPath = worldPath ? join(worldPath, 'LevelMeta.sav') : join(options.snapshotPath, 'SaveGames', '0', '<world-id>', 'LevelMeta.sav');
  const worldOptionPath = worldPath ? join(worldPath, 'WorldOption.sav') : join(options.snapshotPath, 'SaveGames', '0', '<world-id>', 'WorldOption.sav');
  const playerFiles = getPlayerFiles(worldPath);
  const snapshotName = basename(options.snapshotPath);
  const outputPath = join(options.outputRoot, snapshotName);

  mkdirSync(outputPath, { recursive: true });

  const parsedPlayerFiles = playerFiles.map((playerFile) => ({
    ...playerFile,
    ...parsePlayerMetadata(playerFile.path, outputPath, options)
  }));
  const parsedWorldMeta = parseWorldMetadata(
    toFileFact(levelMetaPath).exists ? levelMetaPath : null,
    outputPath,
    options
  );
  const parsedWorldOption = parseWorldMetadata(
    toFileFact(worldOptionPath).exists ? worldOptionPath : null,
    outputPath,
    options
  );

  const manifest: SnapshotManifest = {
    snapshotPath: options.snapshotPath,
    outputPath,
    generatedAt,
    worldId: detected.worldId,
    files: {
      level: toFileFact(levelPath),
      levelMeta: toFileFact(levelMetaPath),
      worldOption: toFileFact(worldOptionPath).exists ? toFileFact(worldOptionPath) : null,
      players: parsedPlayerFiles
    },
    validation: {
      hasSaveGamesRoot: detected.hasSaveGamesRoot,
      hasWorldDirectory: Boolean(worldPath),
      hasLevelSav: toFileFact(levelPath).exists,
      hasLevelMetaSav: toFileFact(levelMetaPath).exists,
      playerSaveCount: playerFiles.length,
      ok: detected.hasSaveGamesRoot && Boolean(worldPath) && toFileFact(levelPath).exists && toFileFact(levelMetaPath).exists
    }
  };

  const worldSummary: WorldSummary = {
    snapshotPath: options.snapshotPath,
    generatedAt,
    worldId: detected.worldId,
    worldFiles: {
      level: manifest.files.level,
      levelMeta: manifest.files.levelMeta,
      worldOption: manifest.files.worldOption
    },
    parseStatus: {
      worldData: 'stub_not_parsed',
      worldMeta: parsedWorldMeta.parseStatus === 'parsed' ? 'stub_not_parsed' : 'stub_not_parsed',
      worldOptions: manifest.files.worldOption ? 'stub_not_parsed' : 'not_present'
    },
    decodedMetadata: {
      levelMeta: parsedWorldMeta.metadata,
      worldOption: parsedWorldOption.metadata
    },
    decodeMessages: {
      levelMeta: parsedWorldMeta.message,
      worldOption: parsedWorldOption.message
    }
  };

  const playersSummary: PlayersSummary = {
    snapshotPath: options.snapshotPath,
    generatedAt,
    worldId: detected.worldId,
    playerSaveCount: playerFiles.length,
    playerFiles: parsedPlayerFiles,
    parseStatus: {
      playerData: parsedPlayerFiles.some((player) => player.parseStatus.status === 'parsed')
        ? 'partially_parsed'
        : 'stub_not_parsed'
    }
  };

  writeJson(join(outputPath, 'snapshot-manifest.json'), manifest);
  writeJson(join(outputPath, 'world-summary.json'), worldSummary);
  writeJson(join(outputPath, 'players-summary.json'), playersSummary);

  console.log('Palworld save parse stub completed');
  console.log(`  snapshot: ${options.snapshotPath}`);
  console.log(`  output:   ${outputPath}`);
  console.log(`  worldId:  ${detected.worldId ?? 'not-detected'}`);
  console.log(`  players:  ${playerFiles.length}`);
  console.log(`  valid:    ${manifest.validation.ok ? 'yes' : 'no'}`);
}

main();
