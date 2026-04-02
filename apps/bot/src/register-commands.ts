import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { botConfig, getDiscordRegistrationConfig } from './config.js';
import { commands } from './commands/index.js';

const { clientId, guildId } = getDiscordRegistrationConfig();

const rest = new REST({ version: '10' }).setToken(botConfig.token);
const commandPayload = commands.map((command) => command.data.toJSON());

await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: commandPayload
});

console.log(`Registered ${commandPayload.length} slash commands for guild ${guildId}`);
