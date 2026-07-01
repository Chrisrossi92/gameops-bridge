import { normalizedEventSchema, type CollectorHealth, type NormalizedEvent } from '@gameops/shared';
import { isHealthRecordingCollector } from './base.js';
import type { CollectorRegistry } from './registry.js';
import type { CollectorRunResult, GameCollector } from './types.js';

export type CollectorEventForwarder = (events: NormalizedEvent[], collector: GameCollector) => Promise<void> | void;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nowMs(): number {
  return Date.now();
}

export class CollectorRunner {
  private readonly registry: CollectorRegistry;
  private readonly forwardEvents: CollectorEventForwarder;

  public constructor(input: {
    registry: CollectorRegistry;
    forwardEvents: CollectorEventForwarder;
  }) {
    this.registry = input.registry;
    this.forwardEvents = input.forwardEvents;
  }

  public async runOnce(): Promise<CollectorRunResult[]> {
    const results: CollectorRunResult[] = [];

    for (const collector of this.registry.enabled()) {
      const startedAtMs = nowMs();

      try {
        const collected = await collector.collect();
        const events = collected.map((event) => normalizedEventSchema.parse(event));

        if (events.length > 0) {
          await this.forwardEvents(events, collector);
        }

        const durationMs = nowMs() - startedAtMs;

        if (isHealthRecordingCollector(collector)) {
          collector.recordCollectionSuccess({
            collectedAt: new Date(startedAtMs + durationMs).toISOString(),
            durationMs,
            emitted: events.length
          });
        }

        results.push({
          collectorId: collector.collectorId,
          ok: true,
          emitted: events.length,
          durationMs,
          error: null
        });
      } catch (error) {
        const durationMs = nowMs() - startedAtMs;
        const message = toErrorMessage(error);

        if (isHealthRecordingCollector(collector)) {
          collector.recordCollectionFailure({
            durationMs,
            error: message
          });
        }

        results.push({
          collectorId: collector.collectorId,
          ok: false,
          emitted: 0,
          durationMs,
          error: message
        });
      }
    }

    return results;
  }

  public health(): CollectorHealth[] {
    return this.registry.health();
  }
}
