import { activeSessionsResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { formatDurationCompact } from '../services/time-format.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
function getOnlineDuration(startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return formatDurationCompact(seconds);
}
export const serverOnlineCommand = {
    data: new SlashCommandBuilder()
        .setName('server-online')
        .setDescription('Show who is currently online for a server')
        .addStringOption((option) => option
        .setName('server-id')
        .setDescription('Server identifier (defaults to this guild configured server)')
        .setRequired(false)),
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
        const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/sessions/active`);
        if (!response.ok) {
            await interaction.reply({
                content: `API request failed with status ${response.status}`,
                ephemeral: true
            });
            return;
        }
        const payload = await response.json();
        const parsed = activeSessionsResponseSchema.safeParse(payload);
        if (!parsed.success) {
            await interaction.reply({
                content: 'API returned an unexpected active sessions payload shape.',
                ephemeral: true
            });
            return;
        }
        if (parsed.data.sessions.length === 0) {
            await interaction.reply(`No active players for server ${serverId}.`);
            return;
        }
        const lines = parsed.data.sessions.slice(0, 15).map((session) => {
            return `• **${session.playerName}** — online ${getOnlineDuration(session.startedAt)}`;
        });
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`Online Players: ${serverId}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `${parsed.data.sessions.length} active player(s)` });
        await interaction.reply({ embeds: [embed] });
    }
};
//# sourceMappingURL=server-online.js.map