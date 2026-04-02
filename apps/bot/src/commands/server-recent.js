import { recentEventsResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
function formatEventLabel(eventType) {
    switch (eventType) {
        case 'PLAYER_JOIN':
            return 'Player Joined';
        case 'PLAYER_LEAVE':
            return 'Player Left';
        case 'HEALTH_WARN':
            return 'Health Warning';
        case 'SERVER_ONLINE':
            return 'Server Online';
        default:
            return eventType.replaceAll('_', ' ');
    }
}
function formatRecentLine(event) {
    const when = new Date(event.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const label = formatEventLabel(event.eventType);
    if ((event.eventType === 'PLAYER_JOIN' || event.eventType === 'PLAYER_LEAVE') && event.playerName) {
        return `• ${when} — **${label}:** ${event.playerName}`;
    }
    if (event.message) {
        return `• ${when} — **${label}:** ${event.message}`;
    }
    return `• ${when} — **${label}**`;
}
export const serverRecentCommand = {
    data: new SlashCommandBuilder()
        .setName('server-recent')
        .setDescription('Show recent normalized events for a server')
        .addStringOption((option) => option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false))
        .addIntegerOption((option) => option
        .setName('limit')
        .setDescription('How many events to show (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)),
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
        const requestedLimit = interaction.options.getInteger('limit') ?? 5;
        const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/events?limit=${requestedLimit}`);
        if (!response.ok) {
            await interaction.reply({
                content: `API request failed with status ${response.status}`,
                ephemeral: true
            });
            return;
        }
        const payload = await response.json();
        const parsed = recentEventsResponseSchema.safeParse(payload);
        if (!parsed.success) {
            await interaction.reply({
                content: 'API returned an unexpected events payload shape.',
                ephemeral: true
            });
            return;
        }
        if (parsed.data.events.length === 0) {
            await interaction.reply(`No recent events found for server ${serverId}.`);
            return;
        }
        const lines = parsed.data.events.map((event) => formatRecentLine(event));
        const embed = new EmbedBuilder()
            .setColor(0x4f46e5)
            .setTitle(`Recent Events: ${serverId}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `${parsed.data.events.length} event(s)` });
        await interaction.reply({ embeds: [embed] });
    }
};
//# sourceMappingURL=server-recent.js.map