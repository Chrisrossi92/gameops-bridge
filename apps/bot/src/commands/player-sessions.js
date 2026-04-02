import { recentSessionsResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { formatDurationCompact } from '../services/time-format.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
export const playerSessionsCommand = {
    data: new SlashCommandBuilder()
        .setName('player-sessions')
        .setDescription('Show recent closed sessions for a player')
        .addStringOption((option) => option
        .setName('player-name')
        .setDescription('Player name')
        .setRequired(true))
        .addStringOption((option) => option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false))
        .addIntegerOption((option) => option
        .setName('limit')
        .setDescription('How many sessions to show (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)),
    async execute(interaction) {
        const playerName = interaction.options.getString('player-name', true).trim();
        const requestedServerId = interaction.options.getString('server-id');
        const requestedLimit = interaction.options.getInteger('limit') ?? 5;
        const resolved = resolveServerIdForGuild(interaction.guildId, requestedServerId);
        const serverId = resolved.serverId;
        if (!serverId) {
            await interaction.reply({
                content: resolved.errorMessage ?? 'Unable to resolve server id.',
                ephemeral: true
            });
            return;
        }
        const fetchLimit = Math.min(Math.max(requestedLimit * 5, 10), 50);
        const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/sessions/recent?limit=${fetchLimit}`);
        if (!response.ok) {
            await interaction.reply({
                content: `API request failed with status ${response.status}`,
                ephemeral: true
            });
            return;
        }
        const payload = await response.json();
        const parsed = recentSessionsResponseSchema.safeParse(payload);
        if (!parsed.success) {
            await interaction.reply({
                content: 'API returned an unexpected recent sessions payload shape.',
                ephemeral: true
            });
            return;
        }
        const matches = parsed.data.sessions
            .filter((session) => session.playerName.toLowerCase() === playerName.toLowerCase())
            .slice(0, requestedLimit);
        if (matches.length === 0) {
            await interaction.reply(`No recent closed sessions found for **${playerName}** on ${serverId}.`);
            return;
        }
        const lines = matches.map((session) => {
            const endedAt = new Date(session.endedAt ?? session.startedAt).toLocaleString();
            const duration = formatDurationCompact(session.durationSeconds ?? 0);
            return `• ${endedAt} — ${duration}`;
        });
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`Recent Sessions: ${playerName}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Server ${serverId}` });
        await interaction.reply({ embeds: [embed] });
    }
};
//# sourceMappingURL=player-sessions.js.map