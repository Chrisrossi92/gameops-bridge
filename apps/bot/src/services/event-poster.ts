import type { NormalizedEvent } from '@gameops/shared';
import { EmbedBuilder, type Client } from 'discord.js';
import { resolveEventChannelId } from '../local-config.js';
import { formatDurationCompact } from './time-format.js';

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:f> • <t:${unix}:R>`;
}

function getEventPresentation(event: NormalizedEvent): { title: string; color: number; description: string } {
  const rawDuration = event.raw?.sessionDurationSeconds;
  const sessionDurationSeconds = typeof rawDuration === 'number' && Number.isFinite(rawDuration)
    ? Math.max(0, Math.floor(rawDuration))
    : null;

  if (event.eventType === 'PLAYER_JOIN') {
    return {
      title: 'Player Joined',
      color: 0x2ecc71,
      description: event.playerName ? `**${event.playerName}** joined the server.` : 'A player joined the server.'
    };
  }

  if (event.eventType === 'PLAYER_LEAVE') {
    const durationText = sessionDurationSeconds !== null ? ` (session ${formatDurationCompact(sessionDurationSeconds)})` : '';
    return {
      title: 'Player Left',
      color: 0x95a5a6,
      description: event.playerName ? `**${event.playerName}** left the server${durationText}.` : `A player left the server${durationText}.`
    };
  }

  if (event.eventType === 'HEALTH_WARN') {
    return {
      title: 'Health Warning',
      color: 0xf39c12,
      description: event.message ? truncate(event.message, 180) : 'Server health warning detected.'
    };
  }

  if (event.eventType === 'SERVER_ONLINE') {
    return {
      title: 'Server Online',
      color: 0x3498db,
      description: event.message ? truncate(event.message, 180) : 'Server reported as online.'
    };
  }

  return {
    title: event.eventType.replaceAll('_', ' '),
    color: 0x607d8b,
    description: event.message ? truncate(event.message, 180) : 'Event received.'
  };
}

function buildEventEmbed(event: NormalizedEvent): EmbedBuilder {
  const presentation = getEventPresentation(event);

  return new EmbedBuilder()
    .setColor(presentation.color)
    .setTitle(presentation.title)
    .setDescription(presentation.description)
    .addFields(
      { name: 'Server', value: event.serverId, inline: true },
      { name: 'When', value: formatTimestamp(event.occurredAt), inline: true }
    );
}

export async function postRoutedEvent(client: Client, event: NormalizedEvent): Promise<boolean> {
  const channelId = resolveEventChannelId(event.serverId, event.eventType);

  if (!channelId) {
    return false;
  }

  console.log(`[route] attempt server=${event.serverId} type=${event.eventType} channel=${channelId}`);
  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    console.warn(`Skipping event route: channel ${channelId} is unavailable or not text-based.`);
    return false;
  }

  await channel.send({ embeds: [buildEventEmbed(event)] });
  console.log(`[route] posted server=${event.serverId} type=${event.eventType} channel=${channelId}`);
  return true;
}
