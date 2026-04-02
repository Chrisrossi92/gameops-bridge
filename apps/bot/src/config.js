function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name} in apps/bot/.env`);
    }
    return value;
}
export const botConfig = {
    token: getRequiredEnv('DISCORD_BOT_TOKEN'),
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001'
};
export function getDiscordRegistrationConfig() {
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
//# sourceMappingURL=config.js.map