import { SlashCommandBuilder } from 'discord.js';
export const pingCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if the bot is responding'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    }
};
//# sourceMappingURL=ping.js.map