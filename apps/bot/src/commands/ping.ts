import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from './types.js';

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if the bot is responding'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  }
};
