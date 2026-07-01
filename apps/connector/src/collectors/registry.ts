import type { CollectorHealth } from '@gameops/shared';
import type { GameCollector } from './types.js';

export class CollectorRegistry {
  private readonly collectorsById = new Map<string, GameCollector>();

  public register(collector: GameCollector): void {
    const collectorId = collector.collectorId.trim();

    if (!collectorId) {
      throw new Error('Collector ID is required.');
    }

    if (this.collectorsById.has(collectorId)) {
      throw new Error(`Collector already registered: ${collectorId}`);
    }

    this.collectorsById.set(collectorId, collector);
  }

  public list(): GameCollector[] {
    return Array.from(this.collectorsById.values());
  }

  public enabled(): GameCollector[] {
    return this.list().filter((collector) => collector.configuration.enabled);
  }

  public get(collectorId: string): GameCollector | null {
    return this.collectorsById.get(collectorId) ?? null;
  }

  public health(): CollectorHealth[] {
    return this.list().map((collector) => collector.health());
  }
}
