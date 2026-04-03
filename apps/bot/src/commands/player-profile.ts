import { knownPlayerProfileResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
import { formatDurationCompact } from '../services/time-format.js';
import type { BotCommand } from './types.js';

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `• ${value}`).join('\n') : 'None';
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getOnlineDuration(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return formatDurationCompact(seconds);
}

function formatRecentSessionLine(endedAt: string, durationSeconds: number): string {
  return `• ${formatTimestamp(endedAt)} (${formatDurationCompact(durationSeconds)})`;
}

export const playerProfileCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('player-profile')
    .setDescription('Show known identity profile for a player')
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
      `${botConfig.apiBaseUrl}/servers/${serverId}/players/known/${encodeURIComponent(playerName)}`
    );

    if (!response.ok) {
      await interaction.reply({
        content: `API request failed with status ${response.status}`,
        ephemeral: true
      });
      return;
    }

    const payload = await response.json();
    const parsed = knownPlayerProfileResponseSchema.safeParse(payload);

    if (!parsed.success) {
      await interaction.reply({
        content: 'API returned an unexpected player profile payload shape.',
        ephemeral: true
      });
      return;
    }

    if (!parsed.data.player) {
      await interaction.reply(`No known profile found for **${playerName}** on server ${serverId}.`);
      return;
    }

    const { player, isOnline, activeSession, recentSessions } = parsed.data;

    const embed = new EmbedBuilder()
      .setColor(0x1f8b4c)
      .setTitle(`Player Profile: ${player.displayName}`)
      .setDescription(
        [
          `Status: **${isOnline ? 'Online' : 'Offline'}**${activeSession ? ` (online ${getOnlineDuration(activeSession.startedAt)})` : ''}`,
          `Confidence: **${player.confidence}**`,
          `Observations: **${player.observationCount}**`,
          `First Seen: ${formatTimestamp(player.firstSeenAt)}`,
          `Last Seen: ${formatTimestamp(player.lastSeenAt)}`
        ].join('\n')
      )
      .addFields(
        { name: 'Platform IDs', value: formatList(player.knownPlatformIds), inline: true },
        { name: 'PlayFab IDs', value: formatList(player.knownPlayFabIds), inline: true },
        { name: 'Character IDs', value: formatList(player.knownCharacterIds), inline: true },
        { name: 'Identity Sources', value: formatList(player.identitySources), inline: false }
      )
      .addFields({
        name: 'Recent Sessions',
        value: recentSessions.length > 0
          ? recentSessions
            .slice(0, 5)
            .map((session) => formatRecentSessionLine(
              session.endedAt ?? session.startedAt,
              session.durationSeconds ?? 0
            ))
            .join('\n')
          : 'None yet',
        inline: false
      })
      .setFooter({ text: `Server ${serverId} • Key ${player.normalizedPlayerKey}` });

    await interaction.reply({ embeds: [embed] });
  }
};
