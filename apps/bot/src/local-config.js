import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { eventTypeSchema } from '@gameops/shared';
import { z } from 'zod';
import { getConfiguredServerById, getConfiguredServers } from './shared-config.js';
const routedEventTypeSchema = z.enum([
    'PLAYER_JOIN',
    'PLAYER_LEAVE',
    'HEALTH_WARN',
    'SERVER_ONLINE',
    'SERVER_OFFLINE',
    'SERVER_RESTARTING',
    'INCIDENT_OPENED'
]);
const localBotConfigSchema = z.object({
    guildDefaults: z.record(z.string(), z.string().min(1)).default({}),
    channelGroups: z.record(z.string(), z.object({
        activity: z.string().min(1),
        alerts: z.string().min(1)
    })).default({}),
    eventRoutes: z.record(z.string(), z.partialRecord(routedEventTypeSchema, z.string().min(1))).default({}),
    polling: z.object({
        intervalMs: z.number().int().min(1000).default(5000),
        fetchLimit: z.number().int().min(1).max(50).default(20)
    }).default({
        intervalMs: 5000,
        fetchLimit: 20
    })
});
function resolveConfigPath() {
    const rawPath = process.env.BOT_LOCAL_CONFIG_PATH ?? './config/bot.local.json';
    return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}
let cachedConfig = null;
export function getLocalBotConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    const configPath = resolveConfigPath();
    try {
        const content = readFileSync(configPath, 'utf8');
        const parsedJson = JSON.parse(content);
        const parsedConfig = localBotConfigSchema.parse(parsedJson);
        console.log('Loaded bot config:', parsedConfig);
        console.log('Bot config summary:', {
            path: configPath,
            guildDefaultCount: Object.keys(parsedConfig.guildDefaults).length,
            routedServerCount: Object.keys(parsedConfig.eventRoutes).length,
            pollIntervalMs: parsedConfig.polling.intervalMs,
            pollFetchLimit: parsedConfig.polling.fetchLimit
        });
        cachedConfig = parsedConfig;
        return parsedConfig;
    }
    catch (error) {
        throw new Error(`Failed to load bot local config at ${configPath}. Copy apps/bot/config/bot.local.example.json to that path and fill in channel IDs.`, { cause: error });
    }
}
export function resolveDefaultServerId(guildId) {
    const config = getLocalBotConfig();
    const configuredServers = getConfiguredServers();
    const guildDefault = config.guildDefaults[guildId];
    if (guildDefault) {
        if (configuredServers.length === 0) {
            return guildDefault;
        }
        const existsInSharedConfig = configuredServers.some((server) => server.id === guildDefault);
        if (existsInSharedConfig) {
            return guildDefault;
        }
        console.warn(`[bot] guild-default-server-missing guild=${guildId} server=${guildDefault} reason=not_in_shared_config`);
    }
    if (configuredServers.length === 1) {
        return configuredServers[0]?.id ?? null;
    }
    return null;
}
export function resolveEventChannelId(serverId, eventType) {
    const config = getLocalBotConfig();
    const routes = config.eventRoutes[serverId];
    if (!routes) {
        return null;
    }
    const parsedEventType = routedEventTypeSchema.safeParse(eventType);
    if (!parsedEventType.success) {
        return null;
    }
    return routes[parsedEventType.data] ?? null;
}
export function getRoutedServerIds() {
    const configuredServers = getConfiguredServers();
    if (configuredServers.length > 0) {
        return configuredServers.map((server) => server.id);
    }
    const config = getLocalBotConfig();
    return Object.keys(config.eventRoutes);
}
export function getPollingConfig() {
    const config = getLocalBotConfig();
    return {
        intervalMs: config.polling.intervalMs,
        fetchLimit: config.polling.fetchLimit
    };
}
export function getKnownServerMetadata(serverId) {
    return getConfiguredServerById(serverId);
}
export function getKnownServerIds() {
    const configuredServers = getConfiguredServers();
    if (configuredServers.length > 0) {
        return configuredServers.map((server) => server.id);
    }
    const config = getLocalBotConfig();
    return Object.keys(config.eventRoutes);
}
//# sourceMappingURL=local-config.js.map