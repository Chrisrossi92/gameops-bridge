import { getSharedApiBaseUrl, getSharedDiscordRegistrationConfig } from './shared-config.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in apps/bot/.env`);
  }

  return value;
}

const sharedDiscord = getSharedDiscordRegistrationConfig();

export const botConfig = {
  token: getRequiredEnv('DISCORD_BOT_TOKEN'),
  clientId: process.env.DISCORD_CLIENT_ID ?? sharedDiscord.clientId,
  guildId: process.env.DISCORD_GUILD_ID ?? sharedDiscord.guildId,
  apiBaseUrl: process.env.API_BASE_URL ?? getSharedApiBaseUrl() ?? 'http://localhost:3001'
};

export function getDiscordRegistrationConfig(): { clientId: string; guildId: string } {
  const clientId = botConfig.clientId;
  const guildId = botConfig.guildId;

  if (!clientId) {
    throw new Error('Missing DISCORD_CLIENT_ID in apps/bot/.env');
  }

  if (!guildId) {
    throw new Error('Missing DISCORD_GUILD_ID in apps/bot/.env');
  }

  return { clientId, guildId };
}
