import type { CollectorHealth, NormalizedEvent } from '@gameops/shared';
import {
  buildPlayerSnapshot,
  diffPlayerSnapshots,
  fetchPlayers,
  type PalworldPlayerIdentity,
  type PalworldRestConfig,
  type PalworldRestPlayer
} from '../adapters/palworld/rest.js';
import { BaseCollector } from './base.js';
import type { CollectorConfiguration } from './types.js';

export type PalworldSnapshotFetcher = (config: PalworldRestConfig) => Promise<PalworldRestPlayer[]>;

export class PalworldCollector extends BaseCollector {
  private readonly fetchSnapshotPlayers: PalworldSnapshotFetcher;
  private previousSnapshot: Map<string, PalworldPlayerIdentity> | null = null;
  private snapshotSize = 0;
  private joinedCount = 0;
  private leftCount = 0;
  private lastSuccessfulPollAt: string | null = null;
  private snapshotLastError: string | null = null;

  public constructor(configuration: CollectorConfiguration, input: {
    fetchPlayers?: PalworldSnapshotFetcher;
  } = {}) {
    super({
      collectorId: `palworld:${configuration.serverId}:${configuration.mode}`,
      name: configuration.label ?? 'Palworld Collector',
      game: 'palworld',
      configuration
    });

    this.fetchSnapshotPlayers = input.fetchPlayers ?? fetchPlayers;
  }

  private getRestConfig(): PalworldRestConfig {
    if (
      !this.configuration.restHost
      || !this.configuration.restPort
      || !this.configuration.restUsername
      || !this.configuration.restPassword
    ) {
      throw new Error('Palworld snapshot collector requires restHost, restPort, restUsername, and restPassword.');
    }

    return {
      host: this.configuration.restHost,
      port: this.configuration.restPort,
      username: this.configuration.restUsername,
      password: this.configuration.restPassword,
      ...(this.configuration.restPath ? { path: this.configuration.restPath } : {})
    };
  }

  public async collect(): Promise<NormalizedEvent[]> {
    if (this.configuration.mode !== 'rest') {
      return [];
    }

    try {
      const players = await this.fetchSnapshotPlayers(this.getRestConfig());
      const currentSnapshot = buildPlayerSnapshot(players);
      const occurredAt = new Date().toISOString();
      const previousSnapshot = this.previousSnapshot;
      const events = previousSnapshot
        ? diffPlayerSnapshots(previousSnapshot, currentSnapshot, this.configuration.serverId, occurredAt)
        : [];

      if (!previousSnapshot && this.configuration.emitInitialSnapshot) {
        events.push(...diffPlayerSnapshots(new Map(), currentSnapshot, this.configuration.serverId, occurredAt));
      }

      this.previousSnapshot = currentSnapshot;
      this.snapshotSize = currentSnapshot.size;
      this.joinedCount = events.filter((event) => event.eventType === 'PLAYER_JOIN').length;
      this.leftCount = events.filter((event) => event.eventType === 'PLAYER_LEAVE').length;
      this.lastSuccessfulPollAt = occurredAt;
      this.snapshotLastError = null;

      return events;
    } catch (error) {
      this.snapshotLastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  public override health(): CollectorHealth {
    return {
      ...super.health(),
      snapshot: {
        snapshotSize: this.snapshotSize,
        joinedCount: this.joinedCount,
        leftCount: this.leftCount,
        lastSuccessfulPollAt: this.lastSuccessfulPollAt,
        lastError: this.snapshotLastError
      }
    };
  }
}
