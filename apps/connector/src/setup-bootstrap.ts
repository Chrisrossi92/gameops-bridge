import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameOpsConfigSchema, type GameOpsConfig } from '@gameops/shared';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type Outcome = 'CREATED' | 'SKIPPED' | 'FAIL';

interface ResultEntry {
  outcome: Outcome;
  message: string;
}

const results: ResultEntry[] = [];

function addResult(outcome: Outcome, message: string): void {
  results.push({ outcome, message });
}

function toAbsolutePath(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(repoRoot, pathValue);
}

function resolveGameOpsConfigPath(): string {
  const rawPath = process.env.GAMEOPS_CONFIG_PATH ?? './config/gameops.config.json';
  return toAbsolutePath(rawPath);
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeIfMissing(path: string, content: string): void {
  if (existsSync(path)) {
    addResult('SKIPPED', `Exists: ${path}`);
    return;
  }

  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf8');
  addResult('CREATED', path);
}

function toUnitSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'server';
}

function buildBotLocalStarter(config: GameOpsConfig): string {
  const enabledServers = config.servers.filter((server) => server.enabled !== false);
  const firstServerId = enabledServers[0]?.id ?? 'replace-with-server-id';
  const eventRouteBlocks = enabledServers.map((server) => {
    return [
      `    "${server.id}": {`,
      '      "PLAYER_JOIN": "REPLACE_ACTIVITY_CHANNEL_ID",',
      '      "PLAYER_LEAVE": "REPLACE_ACTIVITY_CHANNEL_ID",',
      '      "SERVER_ONLINE": "REPLACE_ACTIVITY_CHANNEL_ID",',
      '      "HEALTH_WARN": "REPLACE_ALERTS_CHANNEL_ID"',
      '    }'
    ].join('\n');
  }).join(',\n');

  return [
    '{',
    '  "guildDefaults": {',
    `    "REPLACE_GUILD_ID": "${firstServerId}"`,
    '  },',
    '  "channelGroups": {',
    '    "REPLACE_GUILD_ID": {',
    '      "activity": "REPLACE_ACTIVITY_CHANNEL_ID",',
    '      "alerts": "REPLACE_ALERTS_CHANNEL_ID"',
    '    }',
    '  },',
    '  "eventRoutes": {',
    eventRouteBlocks || '    "REPLACE_SERVER_ID": { "PLAYER_JOIN": "REPLACE_ACTIVITY_CHANNEL_ID" }',
    '  },',
    '  "polling": {',
    '    "intervalMs": 5000,',
    '    "fetchLimit": 20',
    '  }',
    '}',
    ''
  ].join('\n');
}

function buildSecretsExample(config: GameOpsConfig): string {
  const tokenEnv = config.discord.botTokenEnvVar;

  return [
    '# GameOps Bridge runtime secrets/example values',
    '# Copy values into your real env files or your process manager secrets.',
    '',
    `${tokenEnv}=replace-with-discord-bot-token`,
    '',
    '# Optional overrides',
    `GAMEOPS_CONFIG_PATH=${resolve(repoRoot, 'config/gameops.config.json')}`,
    `BOT_LOCAL_CONFIG_PATH=${resolve(repoRoot, 'config/bot.local.json')}`,
    ''
  ].join('\n');
}

function buildApiService(configPath: string): string {
  return [
    '[Unit]',
    'Description=GameOps Bridge API',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${repoRoot}`,
    'Environment=NODE_ENV=production',
    `Environment=GAMEOPS_CONFIG_PATH=${configPath}`,
    'ExecStart=/usr/bin/env npm --workspace apps/api run dev',
    'Restart=on-failure',
    'RestartSec=3',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    ''
  ].join('\n');
}

function buildBotService(configPath: string): string {
  return [
    '[Unit]',
    'Description=GameOps Bridge Discord Bot',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${repoRoot}`,
    'Environment=NODE_ENV=production',
    `Environment=GAMEOPS_CONFIG_PATH=${configPath}`,
    `Environment=BOT_LOCAL_CONFIG_PATH=${resolve(repoRoot, 'config/bot.local.json')}`,
    'ExecStart=/usr/bin/env npm --workspace apps/bot run dev',
    'Restart=on-failure',
    'RestartSec=3',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    ''
  ].join('\n');
}

function buildConnectorService(configPath: string, serverId: string): string {
  return [
    '[Unit]',
    `Description=GameOps Bridge Connector (${serverId})`,
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${repoRoot}`,
    'Environment=NODE_ENV=production',
    `Environment=GAMEOPS_CONFIG_PATH=${configPath}`,
    `Environment=CONNECTOR_SERVER_ID=${serverId}`,
    'ExecStart=/usr/bin/env npm --workspace apps/connector run dev',
    'Restart=on-failure',
    'RestartSec=3',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    ''
  ].join('\n');
}

function printSummaryAndExit(code: number): never {
  const created = results.filter((result) => result.outcome === 'CREATED').length;
  const skipped = results.filter((result) => result.outcome === 'SKIPPED').length;
  const failed = results.filter((result) => result.outcome === 'FAIL').length;

  console.log('\nGameOps Bridge Setup Bootstrap\n');
  for (const result of results) {
    console.log(`[${result.outcome}] ${result.message}`);
  }
  console.log(`\nSummary: created=${created} skipped=${skipped} failed=${failed}`);
  process.exit(code);
}

function main(): void {
  const configPath = resolveGameOpsConfigPath();

  if (!existsSync(configPath)) {
    addResult('FAIL', `Config file not found: ${configPath}`);
    printSummaryAndExit(1);
  }

  let config: GameOpsConfig;

  try {
    const raw = readFileSync(configPath, 'utf8');
    config = gameOpsConfigSchema.parse(JSON.parse(raw) as unknown);
    addResult('CREATED', `Loaded config: ${configPath}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    addResult('FAIL', `Invalid config: ${reason}`);
    printSummaryAndExit(1);
  }

  const enabledServers = config.servers.filter((server) => server.enabled !== false);

  if (enabledServers.length === 0) {
    addResult('FAIL', 'No enabled servers found in config');
    printSummaryAndExit(1);
  }

  const configDir = resolve(repoRoot, 'config');
  const deploySystemdDir = resolve(repoRoot, 'deploy/systemd');
  ensureDir(configDir);
  ensureDir(deploySystemdDir);

  writeIfMissing(resolve(configDir, 'gameops.secrets.example.env'), buildSecretsExample(config));
  writeIfMissing(resolve(configDir, 'bot.local.json'), buildBotLocalStarter(config));
  writeIfMissing(resolve(deploySystemdDir, 'gameops-api.service'), buildApiService(configPath));
  writeIfMissing(resolve(deploySystemdDir, 'gameops-bot.service'), buildBotService(configPath));

  for (const server of enabledServers) {
    const unitName = `gameops-connector-${toUnitSuffix(server.id)}.service`;
    writeIfMissing(
      resolve(deploySystemdDir, unitName),
      buildConnectorService(configPath, server.id)
    );
  }

  printSummaryAndExit(0);
}

main();

