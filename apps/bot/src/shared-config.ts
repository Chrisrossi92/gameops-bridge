import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { gameKeySchema, gameOpsConfigSchema } from '@gameops/shared';

export interface ConfiguredServerMetadata {
  id: string;
  displayName: string;
  game: ReturnType<typeof gameKeySchema.parse>;
}

interface SharedBotRuntimeConfig {
  apiBaseUrl: string;
  discordApplicationId?: string;
  discordGuildId?: string;
  servers: ConfiguredServerMetadata[];
}

let cachedConfig: SharedBotRuntimeConfig | null | undefined;

function resolveConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function loadSharedConfig(): SharedBotRuntimeConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const configPath = resolveConfigPath();

  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);

    const servers = parsed.servers
      .filter((server) => server.enabled !== false)
      .map((server) => ({
        id: server.id,
        displayName: server.displayName,
        game: server.game
      }));

    const runtimeConfig: SharedBotRuntimeConfig = {
      apiBaseUrl: parsed.api.baseUrl,
      ...(parsed.discord.applicationId ? { discordApplicationId: parsed.discord.applicationId } : {}),
      ...(parsed.discord.guildId ? { discordGuildId: parsed.discord.guildId } : {}),
      servers
    };

    console.log(
      `[bot] shared-config-loaded path=${configPath} enabled_servers=${servers.length}`
    );
    cachedConfig = runtimeConfig;
    return runtimeConfig;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[bot] shared-config-unavailable path=${configPath} reason=${reason}`);
    cachedConfig = null;
    return null;
  }
}

export function getConfiguredServers(): ConfiguredServerMetadata[] {
  return loadSharedConfig()?.servers ?? [];
}

export function getConfiguredServerById(serverId: string): ConfiguredServerMetadata | null {
  const normalizedServerId = serverId.trim();

  if (!normalizedServerId) {
    return null;
  }

  return getConfiguredServers().find((server) => server.id === normalizedServerId) ?? null;
}

export function getSharedApiBaseUrl(): string | null {
  return loadSharedConfig()?.apiBaseUrl ?? null;
}

export function getSharedDiscordRegistrationConfig(): { clientId?: string; guildId?: string } {
  const config = loadSharedConfig();

  if (!config) {
    return {};
  }

  return {
    ...(config.discordApplicationId ? { clientId: config.discordApplicationId } : {}),
    ...(config.discordGuildId ? { guildId: config.discordGuildId } : {})
  };
}

