import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import type { ChatInputCommandInteraction } from 'discord.js';
interface CommandShape {
    name: string;
    toJSON: () => RESTPostAPIApplicationCommandsJSONBody;
}
export interface BotCommand {
    data: CommandShape;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
export {};
//# sourceMappingURL=types.d.ts.map