import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { gameKeySchema, ingestEventsRequestSchema, type NormalizedEvent } from '@gameops/shared';
import { getAdapter } from './adapters/index.js';
import { startValheimJournalStream } from './adapters/valheim/journal.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in apps/connector/.env`);
  }

  return value;
}

const connectorModeSchema = z.enum(['file', 'journal']);

const game = gameKeySchema.parse(process.env.GAME_KEY ?? 'valheim');
const mode = connectorModeSchema.parse(process.env.CONNECTOR_MODE ?? 'file');
const serverId = getRequiredEnv('CONNECTOR_SERVER_ID');
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 2000);
const logFile = process.env.VALHEIM_LOG_FILE;

const adapter = getAdapter(game);
let processedLineCount = 0;

const ingestStats = {
  seenLines: 0,
  parsedEvents: 0,
  parseFailures: 0
};

function logIngestStats(reason: string): void {
  console.log(
    `[connector] ${reason} lines=${ingestStats.seenLines} parsed=${ingestStats.parsedEvents} parse_failures=${ingestStats.parseFailures}`
  );
}

async function ingestEvents(events: NormalizedEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const payload = ingestEventsRequestSchema.parse({ events });

  const response = await fetch(`${apiBaseUrl}/events/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ingest failed (${response.status}): ${body}`);
  }

  ingestStats.parsedEvents += events.length;
  console.log(`Ingested ${events.length} ${game} event(s) for server ${serverId}`);
}

function parseLineSafe(line: string): NormalizedEvent | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  ingestStats.seenLines += 1;
  const isJoinOrLeaveDebugLine =
    trimmed.includes('Player joined server') ||
    trimmed.includes('Player connection lost server');

  if (isJoinOrLeaveDebugLine) {
    console.log(`[debug][journal-line] ${trimmed}`);
  }

  try {
    const parsedEvent = adapter.parseLine(trimmed, { serverId });

    if (isJoinOrLeaveDebugLine) {
      if (parsedEvent) {
        console.log(`[debug][journal-match] eventType=${parsedEvent.eventType} player=${parsedEvent.playerName ?? 'unknown'}`);
      } else {
        console.log('[debug][journal-parse-miss] join/leave line was ignored by parser');
      }
    }

    return parsedEvent;
  } catch (error) {
    ingestStats.parseFailures += 1;
    console.warn(`Parse failure for line: ${trimmed.slice(0, 220)}`, error);
    return null;
  }
}

async function runFileMode(): Promise<void> {
  const requiredLogFile = logFile ?? getRequiredEnv('VALHEIM_LOG_FILE');

  console.log(`Starting ${game} connector for ${serverId} in file mode`);
  console.log(`Watching log file: ${requiredLogFile}`);

  async function pollLogsAndIngest(): Promise<void> {
    const content = await readFile(requiredLogFile, 'utf8');
    const allLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (processedLineCount > allLines.length) {
      processedLineCount = 0;
    }

    const newLines = allLines.slice(processedLineCount);
    processedLineCount = allLines.length;

    if (newLines.length === 0) {
      return;
    }

    const events = newLines
      .map((line) => parseLineSafe(line))
      .filter((event): event is NormalizedEvent => event !== null);

    await ingestEvents(events);
    logIngestStats('file poll');
  }

  setInterval(() => {
    void pollLogsAndIngest().catch((error) => {
      console.error('Connector file poll failed', error);
    });
  }, pollIntervalMs);

  void pollLogsAndIngest().catch((error) => {
    console.error('Connector file startup poll failed', error);
  });
}

async function runJournalMode(): Promise<void> {
  console.log(`Starting ${game} connector for ${serverId} in journal mode`);

  await startValheimJournalStream({
    onLine: async (line) => {
      const event = parseLineSafe(line);

      if (!event) {
        return;
      }

      await ingestEvents([event]);
      logIngestStats('journal stream');
    }
  });
}

if (mode === 'journal') {
  await runJournalMode();
} else {
  await runFileMode();
}
