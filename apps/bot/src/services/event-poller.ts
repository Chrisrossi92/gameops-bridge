import { recentEventsResponseSchema, type NormalizedEvent } from '@gameops/shared';
import type { Client } from 'discord.js';
import { botConfig } from '../config.js';
import { getPollingConfig, getRoutedServerIds } from '../local-config.js';
import { postRoutedBurstSummary, postRoutedEvent } from './event-poster.js';

const MAX_FINGERPRINTS = 5000;
const BURST_WINDOW_MS = 12_000;
const BURST_MIN_EVENTS = 3;

function createEventFingerprint(event: NormalizedEvent): string {
  return [
    event.serverId,
    event.eventType,
    event.occurredAt,
    event.playerName ?? '',
    event.message ?? ''
  ].join('|');
}

export function startEventPolling(client: Client): void {
  let serverIds: string[];
  let intervalMs: number;
  let fetchLimit: number;

  try {
    serverIds = getRoutedServerIds();
    const pollingConfig = getPollingConfig();
    intervalMs = pollingConfig.intervalMs;
    fetchLimit = pollingConfig.fetchLimit;
  } catch (error) {
    console.warn('Event polling disabled: local config could not be loaded.', error);
    return;
  }

  if (serverIds.length === 0) {
    console.log('Event polling disabled: no server routes configured.');
    return;
  }

  const seenFingerprints = new Set<string>();
  const fingerprintQueue: string[] = [];
  const primedServers = new Set<string>();

  function rememberFingerprint(fingerprint: string): void {
    if (seenFingerprints.has(fingerprint)) {
      return;
    }

    seenFingerprints.add(fingerprint);
    fingerprintQueue.push(fingerprint);

    if (fingerprintQueue.length > MAX_FINGERPRINTS) {
      const removed = fingerprintQueue.shift();

      if (removed) {
        seenFingerprints.delete(removed);
      }
    }
  }

  async function pollOnce(): Promise<void> {
    const cycleStartedAt = Date.now();
    let fetchedEvents = 0;
    let postedEvents = 0;
    let dedupeSkips = 0;
    let primedEvents = 0;
    let attemptedPosts = 0;

    for (const serverId of serverIds) {
      const response = await fetch(`${botConfig.apiBaseUrl}/servers/${serverId}/events?limit=${fetchLimit}`);

      if (!response.ok) {
        console.warn(`Event poll failed for ${serverId}: HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const parsed = recentEventsResponseSchema.safeParse(payload);

      if (!parsed.success) {
        console.warn(`Event poll returned invalid payload for ${serverId}.`);
        continue;
      }

      const chronologicalEvents = [...parsed.data.events].reverse();
      fetchedEvents += chronologicalEvents.length;

      if (!primedServers.has(serverId)) {
        for (const event of chronologicalEvents) {
          rememberFingerprint(createEventFingerprint(event));
          primedEvents += 1;
        }

        primedServers.add(serverId);
        console.log(`[poll] primed server=${serverId} events=${chronologicalEvents.length}`);
        continue;
      }

      let serverDedupeSkips = 0;
      const unseenEvents: NormalizedEvent[] = [];

      for (const event of chronologicalEvents) {
        const fingerprint = createEventFingerprint(event);

        if (seenFingerprints.has(fingerprint)) {
          dedupeSkips += 1;
          serverDedupeSkips += 1;
          continue;
        }

        rememberFingerprint(fingerprint);
        unseenEvents.push(event);
      }

      let index = 0;

      while (index < unseenEvents.length) {
        const current = unseenEvents[index];

        if (!current) {
          index += 1;
          continue;
        }

        if (current.eventType !== 'PLAYER_JOIN' && current.eventType !== 'PLAYER_LEAVE') {
          attemptedPosts += 1;
          const posted = await postRoutedEvent(client, current);
          if (posted) {
            postedEvents += 1;
          }
          index += 1;
          continue;
        }

        const burstEvents: NormalizedEvent[] = [current];
        const currentMs = Date.parse(current.occurredAt);
        let lookahead = index + 1;

        while (lookahead < unseenEvents.length) {
          const candidate = unseenEvents[lookahead];

          if (!candidate || candidate.eventType !== current.eventType) {
            break;
          }

          const candidateMs = Date.parse(candidate.occurredAt);
          const ageMs = Math.abs(candidateMs - currentMs);

          if (!Number.isFinite(candidateMs) || !Number.isFinite(currentMs) || ageMs > BURST_WINDOW_MS) {
            break;
          }

          burstEvents.push(candidate);
          lookahead += 1;
        }

        if (burstEvents.length >= BURST_MIN_EVENTS) {
          attemptedPosts += 1;
          const posted = await postRoutedBurstSummary(client, serverId, current.eventType, burstEvents);
          if (posted) {
            postedEvents += 1;
          }
          console.log(`[poll] compacted burst server=${serverId} type=${current.eventType} count=${burstEvents.length}`);
          index += burstEvents.length;
          continue;
        }

        attemptedPosts += 1;
        const posted = await postRoutedEvent(client, current);
        if (posted) {
          postedEvents += 1;
        }
        index += 1;
      }

      if (serverDedupeSkips > 0) {
        console.log(`[poll] dedupe-skipped server=${serverId} count=${serverDedupeSkips}`);
      }
    }

    console.log(
      `[poll] cycle fetched=${fetchedEvents} primed=${primedEvents} attempts=${attemptedPosts} posted=${postedEvents} dedupe_skips=${dedupeSkips} duration_ms=${Date.now() - cycleStartedAt}`
    );
  }

  console.log(`Event polling started for ${serverIds.length} server(s), interval=${intervalMs}ms.`);

  setInterval(() => {
    void pollOnce().catch((error) => {
      console.error('Event polling iteration failed', error);
    });
  }, intervalMs);

  void pollOnce().catch((error) => {
    console.error('Initial event polling failed', error);
  });
}
