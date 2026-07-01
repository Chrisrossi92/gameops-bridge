import type { CollectorHealth, GameKey, NormalizedEvent } from '@gameops/shared';

export interface CollectorConfiguration {
  serverId: string;
  enabled: boolean;
  mode: string;
  label?: string;
  logFile?: string;
  journalServiceName?: string;
  shadowBackfillLines?: number;
}

export interface GameCollector {
  collectorId: string;
  name: string;
  game: GameKey;
  configuration: CollectorConfiguration;
  collect: () => Promise<NormalizedEvent[]> | NormalizedEvent[];
  health: () => CollectorHealth;
}

export interface CollectorRunResult {
  collectorId: string;
  ok: boolean;
  emitted: number;
  durationMs: number;
  error: string | null;
}
