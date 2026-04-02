import type { BotCommand } from './types.js';
import { pingCommand } from './ping.js';
import { playerSessionsCommand } from './player-sessions.js';
import { serverRecentCommand } from './server-recent.js';
import { serverOnlineCommand } from './server-online.js';
import { serverStatusCommand } from './server-status.js';

export const commands: BotCommand[] = [
  pingCommand,
  serverOnlineCommand,
  playerSessionsCommand,
  serverStatusCommand,
  serverRecentCommand
];

export const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
