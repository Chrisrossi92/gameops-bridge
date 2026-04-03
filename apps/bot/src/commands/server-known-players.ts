import { knownPlayersResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
import type { BotCommand } from './types.js';

export const serverKnownPlayersCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('server-known-players')
    .setDescription('Show known player identities for a server')
    .addStringOption((option) =>
      option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('How many known players to show (1-15)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(15)
    ),
  async execute(interaction) {
    const requestedServerId = interaction.options.getString('server-id');
    const requestedLimit = interaction.options.getInteger('limit') ?? 10;
    const resolved = resolveServerIdForGuild(interaction.guildId, requestedServerId);
    const serverId = resolved.serverId;

    if (!serverId) {
      await interaction.reply({
        content: resolved.errorMessage ?? 'Unable to resolve server id.',
        ephemeral: true
      });
      return;
    }

    const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/players/known?limit=${requestedLimit}`);

    if (!response.ok) {
      await interaction.reply({
        content: `API request failed with status ${response.status}`,
        ephemeral: true
      });
      return;
    }

    const payload = await response.json();
    const parsed = knownPlayersResponseSchema.safeParse(payload);

    if (!parsed.success) {
      await interaction.reply({
        content: 'API returned an unexpected known players payload shape.',
        ephemeral: true
      });
      return;
    }

    if (parsed.data.players.length === 0) {
      await interaction.reply(`No known players tracked yet for server ${serverId}.`);
      return;
    }

    const lines = parsed.data.players.map((player) => {
      return `• **${player.displayName}** — obs ${player.observationCount}, confidence ${player.confidence}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x8e44ad)
      .setTitle(`Known Players: ${serverId}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${parsed.data.players.length} player(s)` });

    await interaction.reply({ embeds: [embed] });
  }
};
