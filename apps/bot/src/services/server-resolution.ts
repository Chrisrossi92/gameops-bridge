import { getKnownServerIds, resolveDefaultServerId } from '../local-config.js';

interface ResolveServerIdResult {
  serverId: string | null;
  errorMessage?: string;
}

export function resolveServerIdForGuild(guildId: string | null, explicitServerId: string | null): ResolveServerIdResult {
  const knownServerIds = getKnownServerIds();
  const normalizedExplicitServerId = explicitServerId?.trim();

  if (normalizedExplicitServerId) {
    if (knownServerIds.length > 0 && !knownServerIds.includes(normalizedExplicitServerId)) {
      return {
        serverId: null,
        errorMessage: `Unknown server-id "${normalizedExplicitServerId}". Known servers: ${knownServerIds.join(', ')}`
      };
    }

    return { serverId: normalizedExplicitServerId };
  }

  if (!guildId) {
    return {
      serverId: null,
      errorMessage: 'Please provide `server-id` when running this command outside a guild.'
    };
  }

  const mappedServerId = resolveDefaultServerId(guildId);

  if (!mappedServerId) {
    return {
      serverId: null,
      errorMessage: `No default server is configured for this guild (${guildId}). Set guildDefaults in apps/bot/config/bot.local.json or provide server-id.`
    };
  }

  return { serverId: mappedServerId };
}
