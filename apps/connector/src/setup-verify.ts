import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { gameOpsConfigSchema } from '@gameops/shared';
import { z } from 'zod';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type CheckLevel = 'PASS' | 'WARN' | 'FAIL';

interface CheckEntry {
  level: CheckLevel;
  message: string;
}

const checks: CheckEntry[] = [];

function addCheck(level: CheckLevel, message: string): void {
  checks.push({ level, message });
}

function toAbsolutePath(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(repoRoot, pathValue);
}

function resolveGameOpsConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return toAbsolutePath(rawPath);
}

function resolveBotLocalConfigPath(): string {
  const rawPath = process.env.BOT_LOCAL_CONFIG_PATH ?? './config/bot.local.json';
  return toAbsolutePath(rawPath);
}

function loadOptionalEnvFiles(): void {
  const envPaths = [
    resolve(repoRoot, '.env'),
    resolve(repoRoot, 'apps/bot/.env'),
    resolve(repoRoot, 'apps/connector/.env'),
    resolve(repoRoot, 'apps/api/.env')
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      loadEnvFile({ path: envPath, override: false, quiet: true });
    }
  }
}

const routedEventTypeSchema = z.enum([
  'PLAYER_JOIN',
  'PLAYER_LEAVE',
  'HEALTH_WARN',
  'SERVER_ONLINE'
]);

const botLocalConfigSchema = z.object({
  guildDefaults: z.record(z.string(), z.string().min(1)).default({}),
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

function checkFileModePath(label: string, rawPath: string): void {
  if (!rawPath.trim()) {
    addCheck('FAIL', `${label}: logPath is empty`);
    return;
  }

  const resolvedPath = toAbsolutePath(rawPath);

  if (!existsSync(resolvedPath)) {
    addCheck('WARN', `${label}: logPath does not exist yet (${resolvedPath})`);
    return;
  }

  try {
    const stat = statSync(resolvedPath);

    if (stat.isDirectory()) {
      addCheck('WARN', `${label}: logPath points to a directory (${resolvedPath})`);
      return;
    }

    addCheck('PASS', `${label}: logPath exists (${resolvedPath})`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    addCheck('WARN', `${label}: could not stat logPath (${resolvedPath}) reason=${reason}`);
  }
}

function printReportAndExit(): never {
  const passCount = checks.filter((entry) => entry.level === 'PASS').length;
  const warnCount = checks.filter((entry) => entry.level === 'WARN').length;
  const failCount = checks.filter((entry) => entry.level === 'FAIL').length;

  console.log('\nGameOps Bridge Setup Verification\n');

  for (const entry of checks) {
    console.log(`[${entry.level}] ${entry.message}`);
  }

  const overall = failCount > 0 ? 'FAIL' : (warnCount > 0 ? 'WARN' : 'PASS');
  console.log(`\nSummary: ${overall} (pass=${passCount} warn=${warnCount} fail=${failCount})`);

  process.exit(failCount > 0 ? 1 : 0);
}

function main(): void {
  loadOptionalEnvFiles();

  const configPath = resolveGameOpsConfigPath();
  addCheck('PASS', `Using config path: ${configPath}`);

  if (!existsSync(configPath)) {
    addCheck('FAIL', `Config file not found: ${configPath}`);
    printReportAndExit();
  }

  let config: z.infer<typeof gameOpsConfigSchema>;

  try {
    const raw = readFileSync(configPath, 'utf8');
    config = gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);
    addCheck('PASS', 'Shared config loaded and validated against schema');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    addCheck('FAIL', `Failed to parse shared config: ${reason}`);
    printReportAndExit();
  }

  const enabledServers = config.servers.filter((server) => server.enabled !== false);

  if (enabledServers.length === 0) {
    addCheck('FAIL', 'No enabled servers found in shared config');
    printReportAndExit();
  }

  addCheck('PASS', `Enabled servers: ${enabledServers.length}`);

  for (const server of enabledServers) {
    const label = `Server ${server.id} (${server.displayName}, ${server.game}, mode=${server.connector.mode})`;

    if (server.connector.mode === 'file') {
      addCheck('PASS', `${label}: file mode config is present`);
      checkFileModePath(label, server.connector.logPath);
      continue;
    }

    if (server.connector.mode === 'journal') {
      if (!server.connector.journalServiceName.trim()) {
        addCheck('FAIL', `${label}: journalServiceName is empty`);
      } else {
        addCheck('PASS', `${label}: journalServiceName=${server.connector.journalServiceName}`);
      }
      continue;
    }

    if (server.connector.mode === 'rest') {
      const missing: string[] = [];

      if (!server.connector.restHost.trim()) {
        missing.push('restHost');
      }

      if (!Number.isInteger(server.connector.restPort) || server.connector.restPort <= 0) {
        missing.push('restPort');
      }

      if (!server.connector.restUsername.trim()) {
        missing.push('restUsername');
      }

      if (!server.connector.restPassword.trim()) {
        missing.push('restPassword');
      }

      if (missing.length > 0) {
        addCheck('FAIL', `${label}: missing/invalid ${missing.join(', ')}`);
      } else {
        addCheck('PASS', `${label}: REST host/port/auth configured`);
      }
      continue;
    }

    if (server.connector.mode === 'rcon') {
      const missing: string[] = [];

      if (!server.connector.rconHost.trim()) {
        missing.push('rconHost');
      }

      if (!Number.isInteger(server.connector.rconPort) || server.connector.rconPort <= 0) {
        missing.push('rconPort');
      }

      if (!server.connector.rconPassword.trim()) {
        missing.push('rconPassword');
      }

      if (missing.length > 0) {
        addCheck('FAIL', `${label}: missing/invalid ${missing.join(', ')}`);
      } else {
        addCheck('PASS', `${label}: rcon host/port/password configured`);
      }
      continue;
    }

    if (server.connector.mode === 'query') {
      const missing: string[] = [];

      if (!server.connector.rconHost.trim()) {
        missing.push('rconHost');
      }

      if (!Number.isInteger(server.connector.queryPort) || server.connector.queryPort <= 0) {
        missing.push('queryPort');
      }

      if (missing.length > 0) {
        addCheck('FAIL', `${label}: missing/invalid ${missing.join(', ')}`);
      } else {
        addCheck('PASS', `${label}: query host/port configured`);
      }
    }
  }

  if (config.featureFlags.botEnabled) {
    const tokenEnvVarName = config.discord.botTokenEnvVar;
    const tokenValue = process.env[tokenEnvVarName]?.trim();

    if (tokenValue) {
      addCheck('PASS', `Discord bot token is set via ${tokenEnvVarName}`);
    } else {
      addCheck('FAIL', `Discord bot is enabled but ${tokenEnvVarName} is not set`);
    }

    if (!config.discord.enabled) {
      addCheck('WARN', 'featureFlags.botEnabled=true but discord.enabled=false');
    }
  } else {
    addCheck('PASS', 'Bot feature disabled; Discord token is not required');
  }

  addCheck('PASS', 'No additional required env-backed secrets detected by current runtime checks');

  const botLocalPath = resolveBotLocalConfigPath();

  if (!existsSync(botLocalPath)) {
    addCheck('WARN', `Optional bot local overlay not found: ${botLocalPath}`);
    printReportAndExit();
  }

  try {
    const botLocalRaw = readFileSync(botLocalPath, 'utf8');
    const botLocalConfig = botLocalConfigSchema.parse(JSON.parse(botLocalRaw) as unknown);
    addCheck('PASS', `Loaded bot local overlay: ${botLocalPath}`);

    const knownServerIds = new Set(enabledServers.map((server) => server.id));

    const unknownGuildDefaults = Object.entries(botLocalConfig.guildDefaults)
      .filter(([, serverId]) => !knownServerIds.has(serverId));

    if (unknownGuildDefaults.length > 0) {
      const rendered = unknownGuildDefaults
        .map(([guildId, serverId]) => `${guildId}->${serverId}`)
        .join(', ');
      addCheck('FAIL', `bot.local guildDefaults reference unknown server IDs: ${rendered}`);
    } else {
      addCheck('PASS', 'bot.local guildDefaults reference known enabled server IDs');
    }

    const unknownEventRoutes = Object.keys(botLocalConfig.eventRoutes)
      .filter((serverId) => !knownServerIds.has(serverId));

    if (unknownEventRoutes.length > 0) {
      addCheck('FAIL', `bot.local eventRoutes contain unknown server IDs: ${unknownEventRoutes.join(', ')}`);
    } else {
      addCheck('PASS', 'bot.local eventRoutes reference known enabled server IDs');
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    addCheck('FAIL', `Failed to parse bot local overlay: ${reason}`);
  }

  printReportAndExit();
}

main();
