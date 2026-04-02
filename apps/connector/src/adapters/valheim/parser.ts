import type { NormalizedEvent } from '@gameops/shared';
import { normalizedEventSchema } from '@gameops/shared';
import type { GameLogAdapter, ParseContext } from '../types.js';

function splitTimestampAndMessage(line: string): { occurredAt: string; message: string } {
  const timestampMatch = /^\[(.+?)\]\s*(.*)$/.exec(line);

  if (!timestampMatch) {
    return {
      occurredAt: new Date().toISOString(),
      message: line.trim()
    };
  }

  const timestamp = timestampMatch[1] ?? '';
  const rawMessage = timestampMatch[2] ?? '';
  const parsedDate = new Date(timestamp);
  return {
    occurredAt: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
    message: rawMessage.trim()
  };
}

function normalizeJournalPrefixes(message: string): string {
  let normalized = message.trim();

  // Example: Apr 02 10:28:44 ubuntu-32gb-ash-2 run-valheim.sh[467370]:
  normalized = normalized.replace(
    /^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+[^:]+:\s*/,
    ''
  );

  // Example: 04/02/2026 10:28:44:
  normalized = normalized.replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}:\s*/, '');

  return normalized.trim();
}

function createEvent(input: Omit<NormalizedEvent, 'game'>): NormalizedEvent {
  return normalizedEventSchema.parse({
    ...input,
    game: 'valheim'
  });
}

function extractPlayerCount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function extractPlayerName(message: string, pattern: RegExp): string | null {
  const match = pattern.exec(message);

  if (!match) {
    return null;
  }

  const captured = match[1]?.trim();
  if (!captured) {
    return null;
  }

  // Strip trailing metadata segments that often appear in journal lines.
  return captured.replace(/\s+\(.*\)$/, '').replace(/\s+\[.*\]$/, '');
}

export const valheimAdapter: GameLogAdapter = {
  game: 'valheim',
  parseLine(line: string, context: ParseContext): NormalizedEvent | null {
    const { occurredAt, message: rawMessage } = splitTimestampAndMessage(line);
    const message = normalizeJournalPrefixes(rawMessage);

    if (!message) {
      return null;
    }

    if (/game server connected|server started|server online/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'SERVER_ONLINE',
        occurredAt,
        message
      });
    }

    const structuredJoinMatch = /player joined server "([^"]+)" that has join code (\d+), now (\d+) player\(s\)/i.exec(message);
    if (structuredJoinMatch) {
      const worldName = structuredJoinMatch[1]?.trim();
      const joinCode = structuredJoinMatch[2]?.trim();
      const currentPlayerCount = extractPlayerCount(structuredJoinMatch[3]);

      if (!worldName || !joinCode || currentPlayerCount === null) {
        return null;
      }

      console.log(
        `[debug][valheim-structured-match] world=${worldName} joinCode=${joinCode} players=${currentPlayerCount}`
      );

      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_JOIN',
        occurredAt,
        message: `World "${worldName}" now has ${currentPlayerCount} player(s) online.`,
        raw: {
          valheimWorldName: worldName,
          valheimJoinCode: joinCode,
          valheimCurrentPlayerCount: currentPlayerCount,
          valheimEventSource: 'journal'
        }
      });
    }

    const structuredLeaveMatch = /player connection lost server "([^"]+)" that has join code (\d+), now (\d+) player\(s\)/i.exec(message);
    if (structuredLeaveMatch) {
      const worldName = structuredLeaveMatch[1]?.trim();
      const joinCode = structuredLeaveMatch[2]?.trim();
      const currentPlayerCount = extractPlayerCount(structuredLeaveMatch[3]);

      if (!worldName || !joinCode || currentPlayerCount === null) {
        return null;
      }

      console.log(
        `[debug][valheim-structured-match] world=${worldName} joinCode=${joinCode} players=${currentPlayerCount}`
      );

      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_LEAVE',
        occurredAt,
        message: `World "${worldName}" now has ${currentPlayerCount} player(s) online.`,
        raw: {
          valheimWorldName: worldName,
          valheimJoinCode: joinCode,
          valheimCurrentPlayerCount: currentPlayerCount,
          valheimEventSource: 'journal'
        }
      });
    }

    const joinedPlayerName = extractPlayerName(
      message,
      /player joined:\s*(.+)$/i
    );
    if (joinedPlayerName) {

      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_JOIN',
        playerName: joinedPlayerName,
        occurredAt,
        message
      });
    }

    const leftPlayerName = extractPlayerName(
      message,
      /player left:\s*(.+)$/i
    );
    if (leftPlayerName) {

      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_LEAVE',
        playerName: leftPlayerName,
        occurredAt,
        message
      });
    }

    if (/(warning|error|exception)/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'HEALTH_WARN',
        occurredAt,
        message
      });
    }

    return null;
  }
};
