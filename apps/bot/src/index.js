import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { botConfig } from './config.js';
import { commandsByName } from './commands/index.js';
import { startEventPolling } from './services/event-poller.js';
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Bot logged in as ${readyClient.user.tag}`);
    startEventPolling(client);
});
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
        return;
    }
    const command = commandsByName.get(interaction.commandName);
    if (!command) {
        await interaction.reply({
            content: `Unknown command: ${interaction.commandName}`,
            ephemeral: true
        });
        return;
    }
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error('Command execution failed', error);
        const replyPayload = {
            content: 'Command failed. Check bot logs for details.',
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload);
            return;
        }
        await interaction.reply(replyPayload);
    }
});
await client.login(botConfig.token);
//# sourceMappingURL=index.js.map