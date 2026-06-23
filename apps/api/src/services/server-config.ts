import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { gameOpsConfigSchema, type GameKey, type GameOpsConfig } from '@gameops/shared';

function resolveConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

export function loadGameOpsConfig(): GameOpsConfig {
  const configPath = resolveConfigPath();
  const raw = readFileSync(configPath, 'utf8');
  return gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);
}

export function isServerConfigured(serverId: string): boolean {
  try {
    return loadGameOpsConfig().servers.some((server) => server.enabled !== false && server.id === serverId);
  } catch {
    return false;
  }
}

export function getConfiguredServerGame(serverId: string): GameKey | null {
  try {
    return loadGameOpsConfig().servers.find((server) => server.enabled !== false && server.id === serverId)?.game ?? null;
  } catch {
    return null;
  }
}
