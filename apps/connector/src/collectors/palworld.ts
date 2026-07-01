import type { NormalizedEvent } from '@gameops/shared';
import { BaseCollector } from './base.js';
import type { CollectorConfiguration } from './types.js';

export class PalworldCollector extends BaseCollector {
  public constructor(configuration: CollectorConfiguration) {
    super({
      collectorId: `palworld:${configuration.serverId}:${configuration.mode}`,
      name: configuration.label ?? 'Palworld Collector',
      game: 'palworld',
      configuration
    });
  }

  public collect(): NormalizedEvent[] {
    return [];
  }
}
