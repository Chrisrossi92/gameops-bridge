import { collectorHealthSchema, type CollectorHealth, type GameKey, type NormalizedEvent } from '@gameops/shared';
import type { CollectorConfiguration, GameCollector } from './types.js';

export abstract class BaseCollector implements GameCollector {
  public readonly collectorId: string;
  public readonly name: string;
  public readonly game: GameKey;
  public readonly configuration: CollectorConfiguration;

  private lastSuccessfulCollectionAt: string | null = null;
  private lastError: string | null = null;
  private lastCollectionDurationMs: number | null = null;
  private totalEventsEmitted = 0;

  protected constructor(input: {
    collectorId: string;
    name: string;
    game: GameKey;
    configuration: CollectorConfiguration;
  }) {
    this.collectorId = input.collectorId;
    this.name = input.name;
    this.game = input.game;
    this.configuration = input.configuration;
  }

  public abstract collect(): Promise<NormalizedEvent[]> | NormalizedEvent[];

  public recordCollectionSuccess(input: {
    collectedAt: string;
    durationMs: number;
    emitted: number;
  }): void {
    this.lastSuccessfulCollectionAt = input.collectedAt;
    this.lastError = null;
    this.lastCollectionDurationMs = Math.max(0, Math.floor(input.durationMs));
    this.totalEventsEmitted += Math.max(0, Math.floor(input.emitted));
  }

  public recordCollectionFailure(input: {
    durationMs: number;
    error: string;
  }): void {
    this.lastError = input.error || 'unknown_error';
    this.lastCollectionDurationMs = Math.max(0, Math.floor(input.durationMs));
  }

  public health(): CollectorHealth {
    return collectorHealthSchema.parse({
      collectorId: this.collectorId,
      name: this.name,
      game: this.game,
      enabled: this.configuration.enabled,
      lastSuccessfulCollectionAt: this.lastSuccessfulCollectionAt,
      lastError: this.lastError,
      lastCollectionDurationMs: this.lastCollectionDurationMs,
      totalEventsEmitted: this.totalEventsEmitted
    });
  }
}

export function isHealthRecordingCollector(collector: GameCollector): collector is GameCollector & Pick<BaseCollector, 'recordCollectionFailure' | 'recordCollectionSuccess'> {
  const maybeRecorder = collector as Partial<BaseCollector>;
  return typeof maybeRecorder.recordCollectionSuccess === 'function'
    && typeof maybeRecorder.recordCollectionFailure === 'function';
}
