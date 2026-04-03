import { playerCharacterAuditResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
import type { BotCommand } from './types.js';

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatList(values: string[], max = 5): string {
  if (values.length === 0) {
    return 'None';
  }

  const lines = values.slice(0, max).map((value) => `• ${value}`);
  const overflow = values.length > max ? `\n• +${values.length - max} more` : '';
  return `${lines.join('\n')}${overflow}`;
}

function getAssessmentLabel(assessment: string): string {
  if (assessment === 'multiple_characters_observed') {
    return 'Multiple distinct character IDs observed (strong evidence)';
  }

  if (assessment === 'possible_multiple_characters') {
    return 'Multiple distinct character IDs observed (possible, limited linkage)';
  }

  if (assessment === 'single_character_observed') {
    return 'Single character ID observed';
  }

  return 'Insufficient evidence';
}

export const playerCharacterAuditCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('player-character-audit')
    .setDescription('Audit known character/account identifier usage for a player')
    .addStringOption((option) =>
      option
        .setName('player-name')
        .setDescription('Player display name or normalized key')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const playerName = interaction.options.getString('player-name', true).trim();
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

    const response = await fetch(
      `${botConfig.apiBaseUrl}/servers/${serverId}/players/known/${encodeURIComponent(playerName)}/audit`
    );

    if (!response.ok) {
      await interaction.reply({
        content: `API request failed with status ${response.status}`,
        ephemeral: true
      });
      return;
    }

    const payload = await response.json();
    const parsed = playerCharacterAuditResponseSchema.safeParse(payload);

    if (!parsed.success) {
      await interaction.reply({
        content: 'API returned an unexpected player audit payload shape.',
        ephemeral: true
      });
      return;
    }

    const audit = parsed.data;

    if (!audit.player) {
      await interaction.reply(`No known profile found for **${playerName}** on server ${serverId}.`);
      return;
    }

    const recentObservationLines = audit.recentObservations
      .slice(0, 5)
      .map((observation) => {
        const parts = [
          formatTimestamp(observation.observedAt),
          observation.characterId ? `char ${observation.characterId}` : undefined,
          observation.platformId ? 'platform' : undefined,
          observation.playFabId ? 'playfab' : undefined,
          `${observation.confidence}/${observation.source}`
        ].filter(Boolean);

        return `• ${parts.join(' • ')}`;
      });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Character Audit: ${audit.player.displayName}`)
      .setDescription(
        [
          `Confidence: **${audit.player.confidence}**`,
          `Assessment: **${getAssessmentLabel(audit.assessment)}**`
        ].join('\n')
      )
      .addFields(
        { name: 'Distinct Character IDs', value: String(audit.distinctCharacterIds.length), inline: true },
        { name: 'Distinct Platform IDs', value: String(audit.distinctPlatformIds.length), inline: true },
        { name: 'Distinct PlayFab IDs', value: String(audit.distinctPlayFabIds.length), inline: true },
        { name: 'Character IDs', value: formatList(audit.distinctCharacterIds, 8), inline: false },
        { name: 'Platform IDs', value: formatList(audit.distinctPlatformIds, 5), inline: true },
        { name: 'PlayFab IDs', value: formatList(audit.distinctPlayFabIds, 5), inline: true },
        {
          name: 'Recent Observations',
          value: recentObservationLines.length > 0 ? recentObservationLines.join('\n') : 'None',
          inline: false
        }
      )
      .setFooter({ text: `Server ${serverId} • Key ${audit.player.normalizedPlayerKey} • Obs ${audit.totalObservations}` });

    await interaction.reply({ embeds: [embed] });
  }
};
