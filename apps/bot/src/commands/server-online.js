import { activeSessionsResponseSchema, knownPlayersResponseSchema } from '@gameops/shared';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { botConfig } from '../config.js';
import { formatDurationCompact } from '../services/time-format.js';
import { resolveServerIdForGuild } from '../services/server-resolution.js';
function getOnlineDuration(startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    return formatDurationCompact(seconds);
}
function normalizePlayerKey(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
function resolveKnownDisplayName(sessionPlayerName, knownPlayers) {
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
        const knownPlayersResponse = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/players/known?limit=100`);
        let knownPlayers = [];
        if (knownPlayersResponse.ok) {
            const knownPayload = await knownPlayersResponse.json();
            const knownParsed = knownPlayersResponseSchema.safeParse(knownPayload);
            if (knownParsed.success) {
                knownPlayers = knownParsed.data.players.map((player) => ({
                    displayName: player.displayName,
                    normalizedPlayerKey: player.normalizedPlayerKey
                }));
            }
        }
        const sessions = parsed.data.sessions;
        const lines = sessions.slice(0, 20).map((session) => {
            const knownDisplayName = resolveKnownDisplayName(session.playerName, knownPlayers);
            const displayName = knownDisplayName ?? session.playerName;
            const aliasSuffix = knownDisplayName && normalizePlayerKey(knownDisplayName) !== normalizePlayerKey(session.playerName)
                ? ` (_${session.playerName}_)`
                : '';
            return `• **${displayName}**${aliasSuffix} — ${getOnlineDuration(session.startedAt)}`;
        });
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`Live Roster: ${serverId}`)
            .setDescription([`Online now: **${sessions.length}**`, '', ...lines].join('\n'))
            .setFooter({ text: `Showing ${Math.min(sessions.length, 20)} of ${sessions.length}` });
        await interaction.reply({ embeds: [embed] });
    }
};
//# sourceMappingURL=server-online.js.map