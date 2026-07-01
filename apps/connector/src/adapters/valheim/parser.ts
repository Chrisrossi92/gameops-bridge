import type { NormalizedEvent } from '@gameops/shared';
import { normalizedEventSchema } from '@gameops/shared';
import type { GameLogAdapter, ParseContext } from '../types.js';

export type ValheimEventCategory =
  | 'world_saved'
  | 'connection_count'
  | 'player_connected_hint'
  | 'player_disconnected_hint'
  | 'socket_closed'
  | 'server_token_refresh'
  | 'health_noise'
  | 'unknown_event';

export type ValheimEventConfidence = 'low' | 'medium' | 'high';

export interface ValheimLineClassification {
  category: ValheimEventCategory;
  confidence: ValheimEventConfidence;
  occurredAt: string;
  message: string;
  rawLine: string;
  emitShadowEvent: boolean;
  details?: Record<string, string | number | boolean>;
}

export function splitTimestampAndMessage(line: string): { occurredAt: string; message: string } {
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

export function normalizeJournalPrefixes(message: string): string {
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

function parseInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
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

export function classifyValheimLine(line: string): ValheimLineClassification {
  const { occurredAt, message: rawMessage } = splitTimestampAndMessage(line);
  const message = normalizeJournalPrefixes(rawMessage);
  const base = {
    occurredAt,
    message,
    rawLine: line
  };

  if (!message) {
    return {
      ...base,
      category: 'unknown_event',
      confidence: 'low',
      emitShadowEvent: false
    };
  }

  if (/world saved/i.test(message)) {
    return {
      ...base,
      category: 'world_saved',
      confidence: 'high',
      emitShadowEvent: true
    };
  }

  const connectionCountMatch = /connections\s+(\d+)\s+zdos[:\s]+(\d+)(?:\s+sent[:\s]+(\d+))?(?:\s+recv[:\s]+(\d+))?/i.exec(message);
  if (connectionCountMatch) {
    return {
      ...base,
      category: 'connection_count',
      confidence: 'high',
      emitShadowEvent: true,
      details: {
        connections: parseInteger(connectionCountMatch[1]) ?? 0,
        zdos: parseInteger(connectionCountMatch[2]) ?? 0,
        sent: parseInteger(connectionCountMatch[3]) ?? 0,
        recv: parseInteger(connectionCountMatch[4]) ?? 0
      }
    };
  }

  if (/rpc_disconnect/i.test(message)) {
    return {
      ...base,
      category: 'player_disconnected_hint',
      confidence: 'medium',
      emitShadowEvent: true
    };
  }

  const closingSocketMatch = /closing socket\s+([a-z0-9:_-]+)/i.exec(message);
  if (closingSocketMatch || /zplayfabsocket::dispose/i.test(message)) {
    return {
      ...base,
      category: 'socket_closed',
      confidence: 'medium',
      emitShadowEvent: true,
      details: {
        ...(closingSocketMatch?.[1] ? { socketId: closingSocketMatch[1] } : {})
      }
    };
  }

  if (/update playfab entity token|entity token/i.test(message)) {
    return {
      ...base,
      category: 'server_token_refresh',
      confidence: 'high',
      emitShadowEvent: true
    };
  }

  if (/lobby refreshed|refresh(?:ed)? lobby/i.test(message)) {
    return {
      ...base,
      category: 'health_noise',
      confidence: 'high',
      emitShadowEvent: true,
      details: {
        noiseType: 'lobby_refreshed'
      }
    };
  }

  if (/got character zdoid from/i.test(message)) {
    return {
      ...base,
      category: 'player_connected_hint',
      confidence: 'medium',
      emitShadowEvent: true
    };
  }

  return {
    ...base,
    category: 'unknown_event',
    confidence: 'low',
    emitShadowEvent: false
  };
}

function extractDisconnectPlayerName(message: string): string | null {
  const patterns = [
    /player connection lost:\s*(.+)$/i,
    /player disconnected:\s*(.+)$/i,
    /disconnect(?:ed)? player:\s*(.+)$/i,
    /zplayfabsocket::dispose.*for\s+player\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const extracted = extractPlayerName(message, pattern);

    if (extracted) {
      return extracted;
    }
  }

  return null;
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
          valheimEventSource: 'journal',
          valheimDisconnectRule: 'structured_connection_lost'
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

    const disconnectPlayerName = extractDisconnectPlayerName(message);
    if (disconnectPlayerName) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_LEAVE',
        playerName: disconnectPlayerName,
        occurredAt,
        message,
        raw: {
          valheimDisconnectRule: 'named_disconnect_line',
          valheimEventSource: 'journal'
        }
      });
    }

    if (/keep socket for playfab\/.+try to reconnect before timeout/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'HEALTH_WARN',
        occurredAt,
        message,
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'playfab_reconnect_timeout_hint',
          valheimEventSource: 'journal'
        }
      });
    }

    const closingSocketMatch = /closing socket\s+([a-z0-9:_-]+)/i.exec(message);
    if (closingSocketMatch?.[1]) {
      const socketId = closingSocketMatch[1].trim();

      return createEvent({
        serverId: context.serverId,
        eventType: 'HEALTH_WARN',
        occurredAt,
        message,
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'socket_closed',
          valheimDisconnectSocketId: socketId,
          valheimEventSource: 'journal'
        }
      });
    }

    if (/zplayfabsocket::dispose/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'HEALTH_WARN',
        occurredAt,
        message,
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'playfab_socket_dispose',
          valheimEventSource: 'journal'
        }
      });
    }

    if (/playfab.*(connection lost|disconnect|timeout|failed)/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'HEALTH_WARN',
        occurredAt,
        message,
        raw: {
          valheimDisconnectSignal: true,
          valheimDisconnectRule: 'playfab_network_error',
          valheimEventSource: 'journal'
        }
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
