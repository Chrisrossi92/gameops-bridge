import { readFileSync, writeFileSync } from 'node:fs';
import {
  palworldHighlightsResponseSchema,
  type PalworldHighlight,
  type PalworldHighlightImportance,
  type PalworldMilestoneFeedEntry,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';

interface PalworldGuildHint {
  guildName?: string | null;
  guildId?: string | null;
  memberCount?: number | null;
  members?: unknown[];
}

interface PalworldBaseAlertInput {
  usagePercent: number;
  estimatedBases: number;
  remainingCapacity: number;
  statusLabel: 'critical' | 'high' | 'warning' | 'safe';
  alertMessage: string;
  growthAlertMessage: string | null;
}

interface PalworldHighlightStateRecord {
  seenGuildKeys: string[];
  guildMemberCounts: Record<string, number>;
}

const PALWORLD_HIGHLIGHT_STATE_PATH = '/var/backups/gameops/palworld-parse-output/latest/palworld-highlight-state.json';
const PALWORLD_GUILD_PLACEHOLDERS = new Set(['', 'unknown', 'unknown guild', 'unnamed guild']);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isLikelyRealGuildName(value: string | null | undefined): boolean {
  return !PALWORLD_GUILD_PLACEHOLDERS.has(normalize(value ?? ''));
}

function getGuildKey(guild: PalworldGuildHint): string | null {
  const guildId = guild.guildId?.trim();

  if (guildId) {
    return `id:${guildId.toLowerCase()}`;
  }

  const guildName = guild.guildName?.trim();
  return guildName && isLikelyRealGuildName(guildName) ? `name:${normalize(guildName)}` : null;
}

function readHighlightState(): Record<string, PalworldHighlightStateRecord> {
  try {
    const parsed = JSON.parse(readFileSync(PALWORLD_HIGHLIGHT_STATE_PATH, 'utf8')) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([serverId, value]) => {
        const candidate = value && typeof value === 'object' && !Array.isArray(value)
          ? value as Partial<PalworldHighlightStateRecord>
          : {};

        return [
          serverId,
          {
            seenGuildKeys: Array.isArray(candidate.seenGuildKeys)
              ? candidate.seenGuildKeys.filter((entry): entry is string => typeof entry === 'string')
              : [],
            guildMemberCounts: candidate.guildMemberCounts && typeof candidate.guildMemberCounts === 'object'
              ? Object.fromEntries(
                Object.entries(candidate.guildMemberCounts as Record<string, unknown>)
                  .filter(([, count]) => typeof count === 'number' && Number.isFinite(count))
                  .map(([guildKey, count]) => [guildKey, count as number])
              )
              : {}
          }
        ] satisfies [string, PalworldHighlightStateRecord];
      })
    );
  } catch {
    return {};
  }
}

function writeHighlightState(state: Record<string, PalworldHighlightStateRecord>): void {
  writeFileSync(PALWORLD_HIGHLIGHT_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function getHighlightImportanceRank(value: PalworldHighlightImportance): number {
  switch (value) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function getDisplayPlayerName(profile: PalworldUnifiedPlayerProfile): string {
  return profile.playerName ?? profile.accountName ?? profile.playerId;
}

export function generatePalworldHighlights(input: {
  serverId: string;
  milestoneFeed: PalworldMilestoneFeedEntry[];
  guilds: PalworldGuildHint[];
  profiles: PalworldUnifiedPlayerProfile[];
  baseAlert: PalworldBaseAlertInput;
}): { serverId: string; highlights: PalworldHighlight[] } {
  const state = readHighlightState();
  const previous = state[input.serverId] ?? {
    seenGuildKeys: [],
    guildMemberCounts: {}
  };
  const highlights: PalworldHighlight[] = [];
  const seenMessages = new Set<string>();

  function pushHighlight(type: string, message: string, importance: PalworldHighlightImportance): void {
    const key = `${type}::${message}`;

    if (seenMessages.has(key)) {
      return;
    }

    seenMessages.add(key);
    highlights.push({ type, message, importance });
  }

  for (const item of input.milestoneFeed) {
    const playerName = item.playerName ?? item.accountName ?? item.playerId;

    if (item.signalKey === 'entered_elite_level_tier') {
      pushHighlight('milestone_elite_tier', `Player ${playerName} reached Elite Tier`, 'high');
    } else if (item.signalKey === 'reached_marathon_session_tier') {
      pushHighlight('milestone_marathon_session', `Player ${playerName} reached Marathon Session Tier`, 'medium');
    }
  }

  for (const guild of input.guilds) {
    const guildName = guild.guildName?.trim() ?? '';
    const guildKey = getGuildKey(guild);
    const memberCount = guild.memberCount ?? (Array.isArray(guild.members) ? guild.members.length : 0);

    if (!guildKey || !isLikelyRealGuildName(guildName)) {
      continue;
    }

    if (!previous.seenGuildKeys.includes(guildKey)) {
      pushHighlight('guild_new', `New guild detected: ${guildName}`, 'medium');
    }

    const previousMemberCount = previous.guildMemberCounts[guildKey] ?? 0;

    if (memberCount >= 2 && memberCount > previousMemberCount) {
      pushHighlight('guild_growth', `Guild ${guildName} now has ${memberCount} members`, memberCount >= 4 ? 'high' : 'medium');
    }
  }

  for (const profile of input.profiles) {
    const playerName = getDisplayPlayerName(profile);

    if (profile.playerIntelligence.impactLevel === 'High Impact') {
      pushHighlight('player_high_impact', `High impact player detected: ${playerName}`, 'high');
      continue;
    }

    if (profile.playerIntelligence.classification === 'Core Player') {
      pushHighlight('player_core', `Core player detected: ${playerName}`, 'medium');
    }
  }

  if (input.baseAlert.growthAlertMessage) {
    pushHighlight('base_growth', 'Base usage is increasing', 'medium');
  } else if (input.baseAlert.statusLabel === 'warning' || input.baseAlert.statusLabel === 'high' || input.baseAlert.statusLabel === 'critical') {
    pushHighlight('base_pressure', input.baseAlert.alertMessage, input.baseAlert.statusLabel === 'critical' ? 'high' : 'medium');
  }

  state[input.serverId] = {
    seenGuildKeys: input.guilds.map(getGuildKey).filter((value): value is string => Boolean(value)),
    guildMemberCounts: Object.fromEntries(
      input.guilds
        .map((guild) => {
          const guildKey = getGuildKey(guild);
          const memberCount = guild.memberCount ?? (Array.isArray(guild.members) ? guild.members.length : 0);
          return guildKey ? [guildKey, memberCount] as const : null;
        })
        .filter((entry): entry is readonly [string, number] => Boolean(entry))
    )
  };
  writeHighlightState(state);

  const sorted = highlights
    .sort((left, right) => {
      const importanceDelta = getHighlightImportanceRank(right.importance) - getHighlightImportanceRank(left.importance);

      if (importanceDelta !== 0) {
        return importanceDelta;
      }

      return left.message.localeCompare(right.message);
    })
    .slice(0, 5);

  return palworldHighlightsResponseSchema.parse({
    serverId: input.serverId,
    highlights: sorted
  });
}
