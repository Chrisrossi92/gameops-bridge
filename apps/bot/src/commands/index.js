import { pingCommand } from './ping.js';
import { playerProfileCommand } from './player-profile.js';
import { playerSessionsCommand } from './player-sessions.js';
import { serverKnownPlayersCommand } from './server-known-players.js';
import { serverRecentCommand } from './server-recent.js';
import { serverOnlineCommand } from './server-online.js';
import { serverStatusCommand } from './server-status.js';
export const commands = [
    pingCommand,
    serverOnlineCommand,
    serverKnownPlayersCommand,
    playerProfileCommand,
    playerSessionsCommand,
    serverStatusCommand,
    serverRecentCommand
];
export const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
//# sourceMappingURL=index.js.map