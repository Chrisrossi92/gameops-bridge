import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { eventTypeSchema } from '@gameops/shared';
import { z } from 'zod';

const routedEventTypeSchema = z.enum([
  'PLAYER_JOIN',
  'PLAYER_LEAVE',
  'HEALTH_WARN',
  'SERVER_ONLINE'
]);

const localBotConfigSchema = z.object({
  guildDefaults: z.record(z.string(), z.string().min(1)).default({}),
  channelGroups: z.record(
    z.string(),
    z.object({
      activity: z.string().min(1),
      alerts: z.string().min(1)
    })
  ).default({}),
  eventRoutes: z.record(
    z.string(),
    z.record(routedEventTypeSchema, z.string().min(1))
  ).default({}),
  polling: z.object({
    intervalMs: z.number().int().min(1000).default(5000),
    fetchLimit: z.number().int().min(1).max(50).default(20)
  }).default({
    intervalMs: 5000,
    fetchLimit: 20
  })
});

export type RoutedEventType = z.infer<typeof routedEventTypeSchema>;
export type LocalBotConfig = z.infer<typeof localBotConfigSchema>;

function resolveConfigPath(): string {
  const rawPath = process.env.BOT_LOCAL_CONFIG_PATH ?? './config/bot.local.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

let cachedConfig: LocalBotConfig | null = null;

export function getLocalBotConfig(): LocalBotConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = resolveConfigPath();

  try {
    const content = readFileSync(configPath, 'utf8');
    const parsedJson = JSON.parse(content) as unknown;
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
  } catch (error) {
    throw new Error(
      `Failed to load bot local config at ${configPath}. Copy apps/bot/config/bot.local.example.json to that path and fill in channel IDs.`,
      { cause: error }
    );
  }
}

export function resolveDefaultServerId(guildId: string): string | null {
  const config = getLocalBotConfig();
  return config.guildDefaults[guildId] ?? null;
}

export function resolveEventChannelId(serverId: string, eventType: z.infer<typeof eventTypeSchema>): string | null {
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

export function getRoutedServerIds(): string[] {
  const config = getLocalBotConfig();
  return Object.keys(config.eventRoutes);
}

export function getPollingConfig(): { intervalMs: number; fetchLimit: number } {
  const config = getLocalBotConfig();
  return {
    intervalMs: config.polling.intervalMs,
    fetchLimit: config.polling.fetchLimit
  };
}
