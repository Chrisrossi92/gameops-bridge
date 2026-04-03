import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { gameKeySchema, ingestEventsRequestSchema } from '@gameops/shared';
import { getAdapter } from './adapters/index.js';
import { startValheimJournalStream } from './adapters/valheim/journal.js';
import { findKnownPlayer, upsertKnownPlayerObservation } from './identity/known-player-store.js';
function getRequiredEnv(name) {
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
const IDENTITY_BUFFER_MAX = 25;
const IDENTITY_CORRELATION_WINDOW_MS = 20_000;
const PENDING_JOIN_BUFFER_MAX = 30;
const PENDING_JOIN_TTL_MS = 30_000;
const recentIdentityCandidates = [];
const pendingJoins = [];
const ingestStats = {
    seenLines: 0,
    parsedEvents: 0,
    parseFailures: 0
};
function normalizeJournalPrefixes(message) {
    let normalized = message.trim();
    normalized = normalized.replace(/^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+[^:]+:\s*/, '');
    normalized = normalized.replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}:\s*/, '');
    return normalized.trim();
}
function pushIdentityCandidate(candidate) {
    recentIdentityCandidates.push(candidate);
    if (recentIdentityCandidates.length > IDENTITY_BUFFER_MAX) {
        recentIdentityCandidates.splice(0, recentIdentityCandidates.length - IDENTITY_BUFFER_MAX);
    }
}
function extractIdentityCandidate(line) {
    const normalized = normalizeJournalPrefixes(line);
    const zdoidMatch = /got character zdoid from\s+([^:]+)\s*:\s*([0-9:]+)/i.exec(normalized);
    if (!zdoidMatch) {
        return null;
    }
    const playerName = zdoidMatch[1]?.trim();
    if (!playerName) {
        return null;
    }
    const platformId = zdoidMatch[2]?.trim();
    const playFabIdMatch = /playfab(?:\s*id)?\s*[:=]\s*([a-z0-9_-]+)/i.exec(normalized);
    const playFabId = playFabIdMatch?.[1]?.trim();
    return {
        playerName,
        observedAtMs: Date.now(),
        source: 'got_character_zdoid',
        ...(platformId ? { platformId } : {}),
        ...(playFabId ? { playFabId } : {})
    };
}
function correlateJoinIdentity(event) {
    if (event.eventType !== 'PLAYER_JOIN' || event.playerName) {
        return event;
    }
    const nowMs = Date.now();
    for (let index = recentIdentityCandidates.length - 1; index >= 0; index -= 1) {
        const candidate = recentIdentityCandidates[index];
        if (!candidate) {
            continue;
        }
        const ageMs = nowMs - candidate.observedAtMs;
        if (ageMs < 0 || ageMs > IDENTITY_CORRELATION_WINDOW_MS) {
            continue;
        }
        recentIdentityCandidates.splice(index, 1);
        return {
            ...event,
            playerName: candidate.playerName,
            raw: {
                ...(event.raw ?? {}),
                valheimResolvedPlayerName: candidate.playerName,
                valheimIdentityConfidence: 'low',
                valheimIdentitySource: candidate.source,
                valheimIdentityPlatformId: candidate.platformId,
                valheimIdentityPlayFabId: candidate.playFabId
            }
        };
    }
    return event;
}
function enqueuePendingJoin(event) {
    pendingJoins.push({
        event,
        observedAtMs: Date.now()
    });
    if (pendingJoins.length > PENDING_JOIN_BUFFER_MAX) {
        const dropped = pendingJoins.shift();
        if (dropped) {
            console.log(`[debug][pending-join-expired] server=${dropped.event.serverId} reason=buffer-overflow`);
        }
    }
    console.log(`[debug][pending-join] server=${event.serverId} queued_at=${new Date().toISOString()}`);
}
function expirePendingJoins(nowMs) {
    const expired = [];
    while (pendingJoins.length > 0) {
        const oldest = pendingJoins[0];
        if (!oldest || nowMs - oldest.observedAtMs <= PENDING_JOIN_TTL_MS) {
            break;
        }
        pendingJoins.shift();
        expired.push(oldest.event);
        console.log(`[debug][pending-join-expired] server=${oldest.event.serverId} age_ms=${nowMs - oldest.observedAtMs}`);
    }
    return expired;
}
function resolvePendingJoinWithIdentity(candidate) {
    for (let index = pendingJoins.length - 1; index >= 0; index -= 1) {
        const pending = pendingJoins[index];
        if (!pending) {
            continue;
        }
        const ageMs = candidate.observedAtMs - pending.observedAtMs;
        if (ageMs < 0 || ageMs > PENDING_JOIN_TTL_MS) {
            continue;
        }
        pendingJoins.splice(index, 1);
        const resolvedEvent = {
            ...pending.event,
            playerName: candidate.playerName,
            raw: {
                ...(pending.event.raw ?? {}),
                valheimResolvedPlayerName: candidate.playerName,
                valheimIdentityConfidence: 'low',
                valheimIdentitySource: candidate.source,
                valheimIdentityPlatformId: candidate.platformId,
                valheimIdentityPlayFabId: candidate.playFabId
            }
        };
        console.log(`[debug][pending-join-resolved] server=${resolvedEvent.serverId} player=${candidate.playerName} age_ms=${ageMs}`);
        return resolvedEvent;
    }
    return null;
}
function enrichJoinFromKnownPlayers(event) {
    if (event.eventType !== 'PLAYER_JOIN' || event.playerName) {
        return event;
    }
    const rawResolvedName = event.raw?.valheimResolvedPlayerName;
    if (typeof rawResolvedName !== 'string' || !rawResolvedName.trim()) {
        return event;
    }
    const knownPlayer = findKnownPlayer(event.serverId, rawResolvedName);
    if (!knownPlayer || knownPlayer.confidence === 'low' || knownPlayer.observationCount < 2) {
        return event;
    }
    return {
        ...event,
        playerName: knownPlayer.displayName,
        raw: {
            ...(event.raw ?? {}),
            valheimResolvedPlayerName: knownPlayer.displayName,
            valheimIdentityConfidence: knownPlayer.confidence,
            valheimIdentitySource: 'known_player_memory'
        }
    };
}
function recordKnownPlayerObservation(event) {
    if (event.eventType !== 'PLAYER_JOIN' || !event.playerName) {
        return;
    }
    const sourceValue = event.raw?.valheimIdentitySource;
    const confidenceValue = event.raw?.valheimIdentityConfidence;
    const platformIdValue = event.raw?.valheimIdentityPlatformId;
    const playFabIdValue = event.raw?.valheimIdentityPlayFabId;
    const source = typeof sourceValue === 'string' && sourceValue.trim() ? sourceValue : 'direct_join_line';
    const confidence = confidenceValue === 'high' || confidenceValue === 'medium' || confidenceValue === 'low'
        ? confidenceValue
        : 'low';
    const platformId = typeof platformIdValue === 'string' && platformIdValue.trim() ? platformIdValue.trim() : undefined;
    const playFabId = typeof playFabIdValue === 'string' && playFabIdValue.trim() ? playFabIdValue.trim() : undefined;
    const observation = {
        serverId: event.serverId,
        displayName: event.playerName,
        observedAt: event.occurredAt,
        source,
        confidence,
        ...(platformId ? { platformId } : {}),
        ...(playFabId ? { playFabId } : {})
    };
    upsertKnownPlayerObservation(observation);
}
function logIngestStats(reason) {
    console.log(`[connector] ${reason} lines=${ingestStats.seenLines} parsed=${ingestStats.parsedEvents} parse_failures=${ingestStats.parseFailures}`);
}
async function ingestEvents(events) {
    if (events.length === 0) {
        return;
    }
    for (const event of events) {
        recordKnownPlayerObservation(event);
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
function parseLineSafe(line) {
    const trimmed = line.trim();
    const nowMs = Date.now();
    const readyEvents = expirePendingJoins(nowMs);
    if (!trimmed) {
        return readyEvents;
    }
    ingestStats.seenLines += 1;
    const identityCandidate = extractIdentityCandidate(trimmed);
    if (identityCandidate) {
        pushIdentityCandidate(identityCandidate);
        const resolvedPendingJoin = resolvePendingJoinWithIdentity(identityCandidate);
        if (resolvedPendingJoin) {
            readyEvents.push(resolvedPendingJoin);
        }
    }
    const isJoinOrLeaveDebugLine = trimmed.includes('Player joined server') ||
        trimmed.includes('Player connection lost server');
    if (isJoinOrLeaveDebugLine) {
        console.log(`[debug][journal-line] ${trimmed}`);
    }
    try {
        const parsedEvent = adapter.parseLine(trimmed, { serverId });
        const correlatedEvent = parsedEvent ? correlateJoinIdentity(parsedEvent) : null;
        const enrichedEvent = correlatedEvent ? enrichJoinFromKnownPlayers(correlatedEvent) : null;
        if (isJoinOrLeaveDebugLine) {
            if (enrichedEvent) {
                console.log(`[debug][journal-match] eventType=${enrichedEvent.eventType} player=${enrichedEvent.playerName ?? 'unknown'}`);
            }
            else {
                console.log('[debug][journal-parse-miss] join/leave line was ignored by parser');
            }
        }
        if (!enrichedEvent) {
            return readyEvents;
        }
        if (enrichedEvent.eventType === 'PLAYER_JOIN' && !enrichedEvent.playerName) {
            enqueuePendingJoin(enrichedEvent);
            return readyEvents;
        }
        readyEvents.push(enrichedEvent);
        return readyEvents;
    }
    catch (error) {
        ingestStats.parseFailures += 1;
        console.warn(`Parse failure for line: ${trimmed.slice(0, 220)}`, error);
        return readyEvents;
    }
}
async function runFileMode() {
    const requiredLogFile = logFile ?? getRequiredEnv('VALHEIM_LOG_FILE');
    console.log(`Starting ${game} connector for ${serverId} in file mode`);
    console.log(`Watching log file: ${requiredLogFile}`);
    async function pollLogsAndIngest() {
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
        const events = newLines.flatMap((line) => parseLineSafe(line));
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
async function runJournalMode() {
    console.log(`Starting ${game} connector for ${serverId} in journal mode`);
    await startValheimJournalStream({
        onLine: async (line) => {
            const events = parseLineSafe(line);
            if (events.length === 0) {
                return;
            }
            await ingestEvents(events);
            logIngestStats('journal stream');
        }
    });
}
if (mode === 'journal') {
    await runJournalMode();
}
else {
    await runFileMode();
}
//# sourceMappingURL=index.js.map