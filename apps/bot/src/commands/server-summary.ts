import {
  activeSessionsResponseSchema,
  knownPlayersResponseSchema,
  recentEventsResponseSchema,
  type NormalizedEvent
} from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { formatDurationCompact } from '../services/time-format.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
import type { BotCommand } from './types.js';

const RECENT_WINDOW_MS = 30 * 60 * 1000;

function normalizePlayerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveKnownDisplayName(
  sessionPlayerName: string,
  knownPlayers: Array<{ displayName: string; normalizedPlayerKey: string }>
): string | null {
  const normalizedSessionName = normalizePlayerKey(sessionPlayerName);

  if (!normalizedSessionName) {
    return null;
  }

  const match = knownPlayers.find((player) => {
    return player.normalizedPlayerKey === normalizedSessionName
      || normalizePlayerKey(player.displayName) === normalizedSessionName;
  });

  return match?.displayName ?? null;
}

function getOnlineDuration(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return formatDurationCompact(seconds);
}

function formatClock(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function summarizeJoinLeave(events: NormalizedEvent[]): { joins: number; leaves: number; lines: string[] } {
  const nowMs = Date.now();
  const filtered = events.filter((event) => {
    if (event.eventType !== 'PLAYER_JOIN' && event.eventType !== 'PLAYER_LEAVE') {
      return false;
    }

    const occurredAtMs = Date.parse(event.occurredAt);
    return Number.isFinite(occurredAtMs) && nowMs - occurredAtMs <= RECENT_WINDOW_MS;
  });

  const joins = filtered.filter((event) => event.eventType === 'PLAYER_JOIN').length;
  const leaves = filtered.filter((event) => event.eventType === 'PLAYER_LEAVE').length;
  const lines = filtered.slice(0, 4).map((event) => {
    const label = event.eventType === 'PLAYER_JOIN' ? '+ join' : '- leave';
    const actor = event.playerName ? ` ${event.playerName}` : '';
    return `• ${formatClock(event.occurredAt)} ${label}${actor}`;
  });

  return { joins, leaves, lines };
}

function summarizeHealthWarnings(events: NormalizedEvent[]): string[] {
  return events
    .filter((event) => event.eventType === 'HEALTH_WARN')
    .slice(0, 2)
    .map((event) => {
      const message = event.message?.trim();
      const compactMessage = message
        ? (message.length > 120 ? `${message.slice(0, 117)}...` : message)
        : 'Health warning';
      return `• ${formatClock(event.occurredAt)} ${compactMessage}`;
    });
}

export const serverSummaryCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('server-summary')
    .setDescription('Show an at-a-glance moderation snapshot for a server')
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

    const [sessionsResponse, knownPlayersResponse, eventsResponse] = await Promise.all([
      fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/sessions/active`),
      fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/players/known?limit=100`),
      fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/events?limit=50`)
    ]);

    if (!sessionsResponse.ok || !knownPlayersResponse.ok || !eventsResponse.ok) {
      const failingStatus = [sessionsResponse, knownPlayersResponse, eventsResponse]
        .find((response) => !response.ok)?.status;
      await interaction.reply({
        content: `API request failed with status ${failingStatus ?? 'unknown'}`,
        ephemeral: true
      });
      return;
    }

    const [sessionsPayload, knownPlayersPayload, eventsPayload] = await Promise.all([
      sessionsResponse.json(),
      knownPlayersResponse.json(),
      eventsResponse.json()
    ]);

    const sessionsParsed = activeSessionsResponseSchema.safeParse(sessionsPayload);
    const knownPlayersParsed = knownPlayersResponseSchema.safeParse(knownPlayersPayload);
    const eventsParsed = recentEventsResponseSchema.safeParse(eventsPayload);

    if (!sessionsParsed.success || !knownPlayersParsed.success || !eventsParsed.success) {
      await interaction.reply({
        content: 'API returned an unexpected summary payload shape.',
        ephemeral: true
      });
      return;
    }

    const sessions = sessionsParsed.data.sessions;
    const knownPlayers = knownPlayersParsed.data.players.map((player) => ({
      displayName: player.displayName,
      normalizedPlayerKey: player.normalizedPlayerKey
    }));
    const events = eventsParsed.data.events;

    const onlineLines = sessions.slice(0, 8).map((session) => {
      const knownName = resolveKnownDisplayName(session.playerName, knownPlayers);
      const displayName = knownName ?? session.playerName;
      const aliasSuffix = knownName && normalizePlayerKey(knownName) !== normalizePlayerKey(session.playerName)
        ? ` (_${session.playerName}_)`
        : '';
      return `• ${displayName}${aliasSuffix} — ${getOnlineDuration(session.startedAt)}`;
    });

    const joinLeaveSummary = summarizeJoinLeave(events);
    const healthLines = summarizeHealthWarnings(events);

    const embed = new EmbedBuilder()
      .setColor(0x2d9cdb)
      .setTitle(`Server Summary: ${serverId}`)
      .setDescription(
        [
          `Online now: **${sessions.length}**`,
          `Known players tracked: **${knownPlayersParsed.data.players.length}**`
        ].join('\n')
      )
      .addFields(
        {
          name: 'Online Players',
          value: onlineLines.length > 0 ? onlineLines.join('\n') : '• None',
          inline: false
        },
        {
          name: 'Recent Joins/Leaves (30m)',
          value: [
            `Joins: **${joinLeaveSummary.joins}** • Leaves: **${joinLeaveSummary.leaves}**`,
            joinLeaveSummary.lines.length > 0 ? joinLeaveSummary.lines.join('\n') : '• No recent joins/leaves'
          ].join('\n'),
          inline: false
        },
        {
          name: 'Latest Health Warnings',
          value: healthLines.length > 0 ? healthLines.join('\n') : '• None',
          inline: false
        }
      )
      .setFooter({ text: 'At-a-glance moderation snapshot' });

    await interaction.reply({ embeds: [embed] });
  }
};
