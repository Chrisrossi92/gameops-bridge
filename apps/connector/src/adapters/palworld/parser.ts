import type { NormalizedEvent } from '@gameops/shared';
import { normalizedEventSchema } from '@gameops/shared';
import type { GameLogAdapter, ParseContext } from '../types.js';

function splitTimestampAndMessage(line: string): { occurredAt: string; message: string } {
  const bracketTimestamp = /^\[(.+?)\]\s*(.*)$/.exec(line);

  if (bracketTimestamp) {
    const parsed = new Date(bracketTimestamp[1] ?? '');
    return {
      occurredAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
      message: (bracketTimestamp[2] ?? '').trim()
    };
  }

  const plainTimestamp = /^(\d{4}[./-]\d{2}[./-]\d{2}\s+\d{2}:\d{2}:\d{2})\s*(.*)$/.exec(line);

  if (plainTimestamp) {
    const parsed = new Date(plainTimestamp[1] ?? '');
    return {
      occurredAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
      message: (plainTimestamp[2] ?? '').trim()
    };
  }

  return {
    occurredAt: new Date().toISOString(),
    message: line.trim()
  };
}

function normalizePrefix(message: string): string {
  let normalized = message.trim();
  normalized = normalized.replace(
    /^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+[^:]+:\s*/,
    ''
  );

  return normalized.trim();
}

function createEvent(input: Omit<NormalizedEvent, 'game'>): NormalizedEvent {
  return normalizedEventSchema.parse({
    ...input,
    game: 'palworld'
  });
}

function cleanPlayerName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+\(.*?\)$/, '')
    .replace(/\s+\[.*?\]$/, '')
    .replace(/[.:;,]+$/, '')
    .trim();

  return cleaned || null;
}

function isLikelyPlayerName(value: string): boolean {
  const normalized = value.trim();

  if (normalized.length < 2 || normalized.length > 64) {
    return false;
  }

  const lower = normalized.toLowerCase();
  const blockedExact = new Set([
    'player',
    'server',
    'session',
    'connection',
    'dedicatedserver',
    'dedicated server',
    'the game'
  ]);

  if (blockedExact.has(lower)) {
    return false;
  }

  if (/\b(joined|left|disconnected|connected|server)\b/i.test(normalized)) {
    return false;
  }

  if (!/[a-z0-9]/i.test(normalized)) {
    return false;
  }

  return true;
}

function extractByPatterns(message: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(message);

    if (!match) {
      continue;
    }

    const candidate = match[1];

    if (!candidate) {
      continue;
    }

    const cleaned = cleanPlayerName(candidate);

    if (cleaned && isLikelyPlayerName(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

export const palworldAdapter: GameLogAdapter = {
  game: 'palworld',
  parseLine(line: string, context: ParseContext): NormalizedEvent | null {
    const { occurredAt, message: rawMessage } = splitTimestampAndMessage(line);
    const message = normalizePrefix(rawMessage);

    if (!message) {
      return null;
    }

    if (/palworld.*(server.*started|startup complete|listening on)/i.test(message)) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'SERVER_ONLINE',
        occurredAt,
        message
      });
    }

    const joinedPlayer = extractByPatterns(message, [
      /\bplayer\s+["']?(.+?)["']?\s+(?:has\s+)?joined(?:\s+the\s+game)?\b/i,
      /^["']?(.+?)["']?\s+joined\s+the\s+game\b/i
    ]);

    if (joinedPlayer) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_JOIN',
        playerName: joinedPlayer,
        occurredAt,
        message
      });
    }

    const leftPlayer = extractByPatterns(message, [
      /\bplayer\s+["']?(.+?)["']?\s+(?:has\s+)?left(?:\s+the\s+game)?\b/i,
      /\bplayer\s+["']?(.+?)["']?\s+disconnected\b/i,
      /^["']?(.+?)["']?\s+left\s+the\s+game\b/i
    ]);

    if (leftPlayer) {
      return createEvent({
        serverId: context.serverId,
        eventType: 'PLAYER_LEAVE',
        playerName: leftPlayer,
        occurredAt,
        message
      });
    }

    if (/(warning|error|exception|fatal|critical|connection lost|disconnect|timed out|timeout|crash)/i.test(message)) {
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
