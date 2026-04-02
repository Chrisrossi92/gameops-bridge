import { resolveDefaultServerId } from '../local-config.js';
export function resolveServerIdForGuild(guildId, explicitServerId) {
    const normalizedExplicitServerId = explicitServerId?.trim();
    if (normalizedExplicitServerId) {
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
            errorMessage: `No default server is configured for this guild (${guildId}). Add one in apps/bot/config/bot.local.json.`
        };
    }
    return { serverId: mappedServerId };
}
//# sourceMappingURL=server-resolution.js.map