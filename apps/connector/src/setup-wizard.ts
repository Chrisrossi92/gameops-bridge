import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gameOpsConfigSchema,
  type GameKey,
  type GameOpsConfig,
  type HostingMode,
  type PalworldConnectorMode,
  type ValheimConnectorMode
} from '@gameops/shared';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const outputPath = resolve(repoRoot, 'config/gameops.config.json');
const secretsExamplePath = resolve(repoRoot, 'config/gameops.secrets.example.env');

const rl = createInterface({ input, output });

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function askText(prompt: string, fallback?: string): Promise<string> {
  while (true) {
    const suffix = fallback ? ` [${fallback}]` : '';
    const raw = await rl.question(`${prompt}${suffix}: `);
    const value = raw.trim() || fallback || '';

    if (value) {
      return value;
    }

    console.log('Value is required.');
  }
}

async function askTextWithHelp(prompt: string, helpText: string, fallback?: string): Promise<string> {
  console.log(helpText);

  while (true) {
    const suffix = fallback ? ` [${fallback}]` : '';
    const raw = await rl.question(`${prompt}${suffix} (type ? for help): `);
    const trimmed = raw.trim();

    if (trimmed === '?') {
      console.log('\nHelp:');
      console.log(helpText);
      continue;
    }

    const value = trimmed || fallback || '';

    if (value) {
      return value;
    }

    console.log('Value is required.');
  }
}

async function askOptionalText(prompt: string, fallback?: string): Promise<string | undefined> {
  const suffix = fallback ? ` [${fallback}]` : '';
  const raw = await rl.question(`${prompt}${suffix}: `);
  const value = raw.trim() || fallback || '';
  return value || undefined;
}

async function askNumber(prompt: string, fallback?: number): Promise<number> {
  while (true) {
    const suffix = fallback !== undefined ? ` [${fallback}]` : '';
    const raw = await rl.question(`${prompt}${suffix}: `);
    const candidate = raw.trim() === '' && fallback !== undefined ? String(fallback) : raw.trim();
    const parsed = Number(candidate);

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    console.log('Enter a valid positive integer.');
  }
}

async function askYesNo(prompt: string, fallback: boolean): Promise<boolean> {
  while (true) {
    const raw = await rl.question(`${prompt} [${fallback ? 'Y/n' : 'y/N'}]: `);
    const value = raw.trim().toLowerCase();

    if (!value) {
      return fallback;
    }

    if (value === 'y' || value === 'yes') {
      return true;
    }

    if (value === 'n' || value === 'no') {
      return false;
    }

    console.log('Please answer y or n.');
  }
}

async function askChoice<T extends string>(prompt: string, choices: readonly T[], fallback?: T): Promise<T> {
  const rendered = choices.join('/');

  while (true) {
    const suffix = fallback ? ` [${fallback}]` : '';
    const raw = await rl.question(`${prompt} (${rendered})${suffix}: `);
    const value = (raw.trim() || fallback || '') as T;

    if (choices.includes(value)) {
      return value;
    }

    console.log(`Choose one of: ${rendered}`);
  }
}

function connectorDisplayLabel(server: GameOpsConfig['servers'][number]): string {
  if (server.game === 'valheim') {
    return server.connector.mode === 'journal'
      ? 'Valheim: journal stream'
      : 'Valheim: log file';
  }

  if (server.connector.mode === 'rest') {
    return 'Palworld: REST API';
  }

  if (server.connector.mode === 'rcon') {
    return 'Palworld: RCON';
  }

  if (server.connector.mode === 'query') {
    return 'Palworld: query';
  }

  return 'Palworld: log file';
}

async function promptServer(index: number, advancedMode: boolean): Promise<GameOpsConfig['servers'][number]> {
  console.log(`\nServer #${index}`);

  const displayName = await askText('Server name');
  const generatedId = toSlug(displayName) || `server-${index}`;
  const id = advancedMode
    ? await askText('Server ID slug', generatedId)
    : generatedId;

  const game = await askChoice<GameKey>('Game', ['valheim', 'palworld'], 'valheim');
  const pollIntervalMs = advancedMode
    ? await askNumber('Connector check interval in ms', 2000)
    : 2000;

  if (game === 'valheim') {
    const sourceChoice = await askChoice(
      'How should we read your Valheim activity?',
      ['journal', 'file'] as const,
      'journal'
    );
    const mode: ValheimConnectorMode = sourceChoice;

    if (mode === 'file') {
      const logPath = await askText(
        'Path to Valheim log file (example: /var/log/valheim/server.log)',
        './samples/valheim.sample.log'
      );

      return {
        id,
        displayName,
        enabled: true,
        game,
        connector: {
          mode,
          pollIntervalMs,
          logPath
        }
      };
    }

    const journalServiceName = await askText(
      'Systemd service name for Valheim (example: run-valheim.service)',
      'run-valheim.service'
    );

    return {
      id,
      displayName,
      enabled: true,
      game,
      connector: {
        mode,
        pollIntervalMs,
        journalServiceName
      }
    };
  }

  const sourceChoice = await askChoice(
    'How should we read your Palworld activity?',
    ['rest', 'rcon', 'query', 'file'] as const,
    'rest'
  );
  const mode: PalworldConnectorMode = sourceChoice;

  if (mode === 'rest') {
    const restHost = await askText('REST API host (example: 127.0.0.1)', '127.0.0.1');
    const restPort = await askNumber('REST API port (example: 8212)', 8212);
    const restUsername = await askText('REST API username', 'admin');
    const restPassword = await askText('REST API password (usually the AdminPassword)');
    const restPath = await askText('REST API base path', '/v1/api');
    const savePath = await askOptionalText('Save path', './Pal/Saved');

    return {
      id,
      displayName,
      enabled: true,
      game,
      connector: {
        mode,
        pollIntervalMs,
        restHost,
        restPort,
        restUsername,
        restPassword,
        restPath,
        savePath
      }
    };
  }

  if (mode === 'rcon') {
    const rconHost = await askText('RCON host (example: 127.0.0.1)', '127.0.0.1');
    const rconPort = await askNumber('RCON port (example: 25575)', 25575);
    const rconPassword = await askText('RCON password (from your Palworld server settings)');
    const savePath = await askOptionalText('Save path', './Pal/Saved');

    return {
      id,
      displayName,
      enabled: true,
      game,
      connector: {
        mode,
        pollIntervalMs,
        rconHost,
        rconPort,
        rconPassword,
        savePath
      }
    };
  }

  if (mode === 'query') {
    const rconHost = await askText('Query host (example: 127.0.0.1)', '127.0.0.1');
    const queryPort = await askNumber('Query port (example: 8211)', 8211);
    const savePath = await askOptionalText('Save path', './Pal/Saved');

    return {
      id,
      displayName,
      enabled: true,
      game,
      connector: {
        mode,
        pollIntervalMs,
        rconHost,
        queryPort,
        savePath
      }
    };
  }

  const logPath = await askText(
    'Path to Palworld log file (example: /var/log/palworld/server.log)',
    './palworld.log'
  );
  const savePath = await askOptionalText('Save path', './Pal/Saved');

  return {
    id,
    displayName,
    enabled: true,
    game,
    connector: {
      mode,
      pollIntervalMs,
      logPath,
      savePath
    }
  };
}

async function main(): Promise<void> {
  console.log('GameOps Bridge Setup Wizard\n');

  const setupMode = await askChoice('Setup style', ['quick', 'advanced'] as const, 'quick');
  const advancedMode = setupMode === 'advanced';

  const workspaceName = await askText('Workspace name', 'GameOps Workspace');
  const workspaceId = advancedMode
    ? await askText('Workspace ID', toSlug(workspaceName) || 'gameops-workspace')
    : (toSlug(workspaceName) || 'gameops-workspace');
  const ownerName = await askText('Your name');
  const hostingMode: HostingMode = advancedMode
    ? await askChoice<HostingMode>('Hosting mode', ['self_hosted', 'hybrid', 'hosted_limited'], 'self_hosted')
    : 'self_hosted';
  const timezone = advancedMode
    ? await askText('Timezone', 'UTC')
    : 'UTC';

  const apiBaseUrl = advancedMode
    ? await askText('API base URL', 'http://localhost:3001')
    : 'http://localhost:3001';
  const apiPort = advancedMode
    ? await askNumber('API port', 3001)
    : 3001;
  const corsOrigin = advancedMode
    ? await askOptionalText('CORS origin (optional)', 'http://localhost:5173')
    : undefined;

  const discordEnabled = await askYesNo('Enable Discord bot integration?', true);
  let applicationId: string | undefined;
  let guildId: string | undefined;

  if (discordEnabled) {
    const hasExistingDiscordBot = await askYesNo('Do you already have a Discord bot application created in Discord Developer Portal?', true);

    if (!hasExistingDiscordBot) {
      console.log('\nDiscord bot quick setup:');
      console.log('1. Open https://discord.com/developers/applications');
      console.log('2. Click "New Application", name it, and create it.');
      console.log('3. Open the "Bot" tab and click "Add Bot".');
      console.log('4. In "OAuth2 > URL Generator", select "bot" and "applications.commands".');
      console.log('5. Pick permissions you need, then open the generated URL to invite the bot to your server.');
      console.log('6. Return here and enter Application ID + Guild ID.');
    }

    applicationId = await askTextWithHelp(
      'Discord Application ID',
      [
        '- This is your Discord app/bot ID (a long numeric value).',
        '- Where to find it:',
        '  1. Go to https://discord.com/developers/applications',
        '  2. Open your application',
        '  3. In "General Information", copy "Application ID"'
      ].join('\n')
    );

    guildId = await askTextWithHelp(
      'Discord Server (Guild) ID',
      [
        '- This is the ID of the Discord server where the bot will run.',
        '- Where to find it:',
        '  1. In Discord, open Settings > Advanced and enable Developer Mode',
        '  2. Right-click your server icon',
        '  3. Click "Copy Server ID"'
      ].join('\n')
    );

    if (applicationId.trim() === guildId.trim()) {
      console.log('\nWarning: Application ID and Guild ID are identical.');
      console.log('These are usually different values. Double-check both IDs before continuing.');
    }
  }

  const servers: GameOpsConfig['servers'] = [];
  let addAnother = true;
  let index = 1;

  while (addAnother || servers.length === 0) {
    servers.push(await promptServer(index, advancedMode));
    index += 1;
    addAnother = await askYesNo('Add another server?', false);
  }

  const featureFlags: GameOpsConfig['featureFlags'] = advancedMode
    ? {
        dashboardEnabled: await askYesNo('Feature: dashboard enabled?', true),
        botEnabled: await askYesNo('Feature: bot enabled?', true),
        connectorEnabled: await askYesNo('Feature: connector enabled?', true),
        identityResolutionEnabled: await askYesNo('Feature: identity resolution enabled?', true),
        sessionReconciliationEnabled: await askYesNo('Feature: session reconciliation enabled?', true)
      }
    : {
        dashboardEnabled: true,
        botEnabled: true,
        connectorEnabled: true,
        identityResolutionEnabled: true,
        sessionReconciliationEnabled: true
      };

  const configCandidate = {
    version: 1,
    workspace: {
      workspaceId,
      workspaceName,
      ownerName,
      hostingMode,
      timezone
    },
    api: {
      baseUrl: apiBaseUrl,
      port: apiPort,
      ...(corsOrigin ? { corsOrigin } : {})
    },
    discord: {
      enabled: discordEnabled,
      applicationId,
      guildId,
      botTokenEnvVar: 'DISCORD_BOT_TOKEN'
    },
    servers,
    featureFlags
  };

  const config = gameOpsConfigSchema.parse(configCandidate);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const requiredSecrets: string[] = [];
  if (discordEnabled) {
    requiredSecrets.push('DISCORD_BOT_TOKEN');
  }

  if (requiredSecrets.length > 0) {
    const envTemplate = [
      '# Fill in required secrets before running services',
      ...requiredSecrets.map((key) => `${key}=`)
    ].join('\n');
    await writeFile(secretsExamplePath, `${envTemplate}\n`, 'utf8');
  }

  console.log('\nSetup complete');
  console.log(`Config written: ${outputPath}`);
  console.log(`Workspace: ${config.workspace.workspaceName}`);
  console.log('Servers:');
  for (const server of config.servers) {
    console.log(`- ${server.displayName} (${server.id}) -> ${connectorDisplayLabel(server)}`);
  }
  console.log('Required env vars / secrets:');
  if (requiredSecrets.length === 0) {
    console.log('- None');
  } else {
    for (const secret of requiredSecrets) {
      console.log(`- ${secret}`);
    }
    console.log(`Secrets example file: ${secretsExamplePath}`);
  }
  console.log('Next commands:');
  console.log('- npm run dev:api');
  console.log('- npm run dev:bot');
  console.log('- npm run dev:connector');
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Setup wizard failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
