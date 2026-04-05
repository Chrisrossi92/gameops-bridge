import { EmbedBuilder } from 'discord.js';
import { resolveEventChannelId } from '../local-config.js';
import { formatDurationCompact } from './time-format.js';
function getResolvedPlayerName(event) {
    if (event.playerName && event.playerName.trim()) {
        return event.playerName.trim();
    }
    const rawName = event.raw?.valheimResolvedPlayerName;
    if (typeof rawName !== 'string' || !rawName.trim()) {
        return null;
    }
    return rawName.trim();
}
function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 3)}...`;
}
function formatTimestamp(value) {
    const date = new Date(value);
    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:f> • <t:${unix}:R>`;
}
function getValheimJournalDetails(event) {
    const worldName = event.raw?.valheimWorldName;
    const joinCode = event.raw?.valheimJoinCode;
    const currentPlayerCount = event.raw?.valheimCurrentPlayerCount;
    if (typeof worldName !== 'string' || typeof joinCode !== 'string' || typeof currentPlayerCount !== 'number') {
        return null;
    }
    if (!worldName.trim() || !joinCode.trim() || !Number.isFinite(currentPlayerCount)) {
        return null;
    }
    return {
        worldName: worldName.trim(),
        joinCode: joinCode.trim(),
        currentPlayerCount: Math.max(0, Math.floor(currentPlayerCount))
    };
}
function getEventPresentation(event) {
    const rawDuration = event.raw?.sessionDurationSeconds;
    const sessionDurationSeconds = typeof rawDuration === 'number' && Number.isFinite(rawDuration)
        ? Math.max(0, Math.floor(rawDuration))
        : null;
    const valheimDetails = getValheimJournalDetails(event);
    const resolvedPlayerName = getResolvedPlayerName(event);
    if (event.eventType === 'PLAYER_JOIN') {
        if (valheimDetails) {
            const playerLabel = resolvedPlayerName ? `**${resolvedPlayerName}**` : 'Player';
            return {
                title: 'Player Joined (+1)',
                color: 0x2ecc71,
                description: `${playerLabel} • online **${valheimDetails.currentPlayerCount}**`,
                extraFields: [
                    { name: 'World', value: valheimDetails.worldName, inline: true },
                    { name: 'Code', value: valheimDetails.joinCode, inline: true }
                ]
            };
        }
        return {
            title: 'Player Joined (+1)',
            color: 0x2ecc71,
            description: event.playerName ? `**${event.playerName}** joined` : 'A player joined'
        };
    }
    if (event.eventType === 'PLAYER_LEAVE') {
        if (valheimDetails) {
            const durationText = sessionDurationSeconds !== null ? ` • session ${formatDurationCompact(sessionDurationSeconds)}` : '';
            const playerLabel = resolvedPlayerName ? `**${resolvedPlayerName}**` : 'Player';
            return {
                title: 'Player Left (-1)',
                color: 0x95a5a6,
                description: `${playerLabel} • online **${valheimDetails.currentPlayerCount}**${durationText}`,
                extraFields: [
                    { name: 'World', value: valheimDetails.worldName, inline: true },
                    { name: 'Code', value: valheimDetails.joinCode, inline: true }
                ]
            };
        }
        const durationText = sessionDurationSeconds !== null ? ` • session ${formatDurationCompact(sessionDurationSeconds)}` : '';
        return {
            title: 'Player Left (-1)',
            color: 0x95a5a6,
            description: event.playerName ? `**${event.playerName}** left${durationText}` : `A player left${durationText}`
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
function buildEventEmbed(event) {
    const presentation = getEventPresentation(event);
    const embed = new EmbedBuilder()
        .setColor(presentation.color)
        .setTitle(presentation.title)
        .setDescription(presentation.description)
        .addFields({ name: 'When', value: formatTimestamp(event.occurredAt), inline: true })
        .setFooter({ text: `Server ${event.serverId}` });
    if (presentation.extraFields && presentation.extraFields.length > 0) {
        embed.addFields(...presentation.extraFields);
    }
    return embed;
}
function buildBurstEmbed(serverId, eventType, events) {
    const deltaPrefix = eventType === 'PLAYER_JOIN' ? '+' : '-';
    const title = eventType === 'PLAYER_JOIN' ? `Join Burst (${deltaPrefix}${events.length})` : `Leave Burst (${deltaPrefix}${events.length})`;
    const color = eventType === 'PLAYER_JOIN' ? 0x27ae60 : 0x7f8c8d;
    const latestEvent = events[events.length - 1];
    const latestDetails = latestEvent ? getValheimJournalDetails(latestEvent) : null;
    const latestWhen = latestEvent ? formatTimestamp(latestEvent.occurredAt) : 'Unknown';
    const names = events
        .map((event) => getResolvedPlayerName(event))
        .filter((value) => Boolean(value));
    const uniqueNames = Array.from(new Set(names));
    const namesLine = uniqueNames.length > 0
        ? uniqueNames.slice(0, 6).map((name) => `\`${name}\``).join(', ')
        : `${events.length} player event(s)`;
    const overflow = uniqueNames.length > 6 ? `, +${uniqueNames.length - 6} more` : '';
    const onlineLine = latestDetails ? `Online now **${latestDetails.currentPlayerCount}**` : '';
    const descriptionParts = [namesLine + overflow, onlineLine].filter(Boolean);
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(descriptionParts.join('\n'))
        .addFields({ name: 'When', value: latestWhen, inline: true })
        .setFooter({ text: `Server ${serverId}` });
    if (latestDetails) {
        embed.addFields({ name: 'World', value: latestDetails.worldName, inline: true }, { name: 'Code', value: latestDetails.joinCode, inline: true });
    }
    return embed;
}
export async function postRoutedEvent(client, event) {
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
export async function postRoutedBurstSummary(client, serverId, eventType, events) {
    if (events.length === 0) {
        return false;
    }
    const channelId = resolveEventChannelId(serverId, eventType);
    if (!channelId) {
        return false;
    }
    console.log(`[route] attempt burst server=${serverId} type=${eventType} count=${events.length} channel=${channelId}`);
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
        console.warn(`Skipping burst route: channel ${channelId} is unavailable or not text-based.`);
        return false;
    }
    await channel.send({ embeds: [buildBurstEmbed(serverId, eventType, events)] });
    console.log(`[route] posted burst server=${serverId} type=${eventType} count=${events.length} channel=${channelId}`);
    return true;
}
//# sourceMappingURL=event-poster.js.map