import { recentEventsResponseSchema } from '@gameops/shared';
import { botConfig } from '../config.js';
import { getPollingConfig, getRoutedServerIds } from '../local-config.js';
import { postRoutedEvent } from './event-poster.js';
const MAX_FINGERPRINTS = 5000;
function createEventFingerprint(event) {
    return [
        event.serverId,
        event.eventType,
        event.occurredAt,
        event.playerName ?? '',
        event.message ?? ''
    ].join('|');
}
export function startEventPolling(client) {
    let serverIds;
    let intervalMs;
    let fetchLimit;
    try {
        serverIds = getRoutedServerIds();
        const pollingConfig = getPollingConfig();
        intervalMs = pollingConfig.intervalMs;
        fetchLimit = pollingConfig.fetchLimit;
    }
    catch (error) {
        console.warn('Event polling disabled: local config could not be loaded.', error);
        return;
    }
    if (serverIds.length === 0) {
        console.log('Event polling disabled: no server routes configured.');
        return;
    }
    const seenFingerprints = new Set();
    const fingerprintQueue = [];
    const primedServers = new Set();
    function rememberFingerprint(fingerprint) {
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
    async function pollOnce() {
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
            for (const event of chronologicalEvents) {
                const fingerprint = createEventFingerprint(event);
                if (seenFingerprints.has(fingerprint)) {
                    dedupeSkips += 1;
                    serverDedupeSkips += 1;
                    continue;
                }
                rememberFingerprint(fingerprint);
                attemptedPosts += 1;
                const posted = await postRoutedEvent(client, event);
                if (posted) {
                    postedEvents += 1;
                }
            }
            if (serverDedupeSkips > 0) {
                console.log(`[poll] dedupe-skipped server=${serverId} count=${serverDedupeSkips}`);
            }
        }
        console.log(`[poll] cycle fetched=${fetchedEvents} primed=${primedEvents} attempts=${attemptedPosts} posted=${postedEvents} dedupe_skips=${dedupeSkips} duration_ms=${Date.now() - cycleStartedAt}`);
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
//# sourceMappingURL=event-poller.js.map