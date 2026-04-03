import type { BotCommand } from './types.js';
import { pingCommand } from './ping.js';
import { playerCharacterAuditCommand } from './player-character-audit.js';
import { playerProfileCommand } from './player-profile.js';
import { playerSessionsCommand } from './player-sessions.js';
import { serverKnownPlayersCommand } from './server-known-players.js';
import { serverRecentCommand } from './server-recent.js';
import { serverOnlineCommand } from './server-online.js';
import { serverSummaryCommand } from './server-summary.js';
import { serverStatusCommand } from './server-status.js';

export const commands: BotCommand[] = [
  pingCommand,
  serverOnlineCommand,
  serverSummaryCommand,
  serverKnownPlayersCommand,
  playerCharacterAuditCommand,
  playerProfileCommand,
  playerSessionsCommand,
  serverStatusCommand,
  serverRecentCommand
];

export const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
