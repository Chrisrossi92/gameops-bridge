import { serverStatusSchema } from '@gameops/shared';
import { SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
import type { BotCommand } from './types.js';

export const serverStatusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('server-status')
    .setDescription('Get mocked server status from the API')
    .addStringOption((option) =>
      option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const requestedServerId = interaction.options.getString('server-id');
    const resolved = resolveServerIdForGuild(interaction.guildId, requestedServerId);
    const serverId = resolved.serverId;

    if (!serverId) {
      await interaction.reply({
        content: resolved.errorMessage ?? 'Unable to resolve server id.',
        ephemeral: true
      });
      return;
    }

    const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/status`);

    if (!response.ok) {
      await interaction.reply({
        content: `API request failed with status ${response.status}`,
        ephemeral: true
      });
      return;
    }

    const payload = await response.json();
    const parsed = serverStatusSchema.safeParse(payload);

    if (!parsed.success) {
      await interaction.reply({
        content: 'API returned an unexpected payload shape.',
        ephemeral: true
      });
      return;
    }

    const status = parsed.data;
    await interaction.reply([
      `Server: ${status.serverId}`,
      `Game: ${status.game}`,
      `State: ${status.state}`,
      `Players: ${status.playerCount}/${status.maxPlayers}`,
      `Checked: ${status.lastCheckedAt}`,
      status.message ? `Note: ${status.message}` : undefined
    ].filter(Boolean).join('\n'));
  }
};
