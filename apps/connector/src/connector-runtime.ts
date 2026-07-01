import {
  connectorHeartbeatRequestSchema,
  type CollectorHealth,
  type ConnectorHeartbeat,
  type GameKey,
  type NormalizedEvent
} from '@gameops/shared';
import { CollectorRegistry, CollectorRunner, PalworldCollector, ValheimCollector } from './collectors/index.js';
import type { ConnectorMode } from './runtime-types.js';

export interface ConnectorCollectorRuntimeSettings {
  serverId: string;
  game: GameKey;
  mode: ConnectorMode;
  collectorsEnabled: boolean;
  logFile?: string;
  journalServiceName?: string;
  restHost?: string;
  restPort?: number;
  restUsername?: string;
  restPassword?: string;
  restPath?: string;
}

export interface ValheimCollectorShadowSettings {
  serverId: string;
  game: GameKey;
  mode: ConnectorMode;
  enabled: boolean;
  backfillLines?: number;
  logFile?: string;
  journalServiceName?: string;
}

export interface ConnectorHeartbeatBuildInput {
  serverId: string;
  game: GameKey;
  mode: ConnectorMode;
  observedAt: string;
  status: 'running' | 'degraded' | 'error';
  message: string;
  capabilities: string[];
  lastSuccessfulPollAt?: string | undefined;
  consecutiveFailureCount?: number | undefined;
  collectors?: CollectorHealth[] | undefined;
}

type ValheimCollectorShadowParityStatus = NonNullable<CollectorHealth['shadow']>['parityStatus'];

function eventTypes(events: NormalizedEvent[]): string[] {
  return events.map((event) => {
    const category = event.raw?.valheimEventCategory;
    return typeof category === 'string' && category.length > 0 ? category : event.eventType;
  });
}

function sameEventTypes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((eventType, index) => eventType === right[index]);
}

function resolveParityStatus(input: {
  collectedTypes: string[];
  oldPathEvents?: NormalizedEvent[] | undefined;
}): ValheimCollectorShadowParityStatus {
  if (!input.oldPathEvents) {
    return 'not_available';
  }

  const oldPathTypes = eventTypes(input.oldPathEvents);
  return sameEventTypes(input.collectedTypes, oldPathTypes) ? 'matching' : 'mismatch';
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  return null;
}

export function resolveCollectorsEnabled(input: {
  env?: NodeJS.ProcessEnv;
  featureFlagValue?: boolean | undefined;
} = {}): boolean {
  const env = input.env ?? process.env;
  return parseBooleanFlag(env.GAMEOPS_COLLECTORS_ENABLED)
    ?? parseBooleanFlag(env.CONNECTOR_COLLECTORS_ENABLED)
    ?? input.featureFlagValue
    ?? false;
}

export function resolveValheimCollectorShadowEnabled(input: {
  env?: NodeJS.ProcessEnv;
  featureFlagValue?: boolean | undefined;
} = {}): boolean {
  const env = input.env ?? process.env;
  return parseBooleanFlag(env.GAMEOPS_VALHEIM_COLLECTOR_SHADOW)
    ?? input.featureFlagValue
    ?? false;
}

export function resolveValheimCollectorShadowBackfillLines(input: {
  env?: NodeJS.ProcessEnv;
  featureFlagValue?: number | undefined;
} = {}): number {
  const env = input.env ?? process.env;
  const rawValue = env.GAMEOPS_VALHEIM_COLLECTOR_SHADOW_BACKFILL_LINES;
  const candidate = rawValue === undefined ? (input.featureFlagValue ?? 0) : Number(rawValue);

  if (!Number.isFinite(candidate)) {
    return 0;
  }

  return Math.max(0, Math.floor(candidate));
}

export function createCollectorRegistry(settings: ConnectorCollectorRuntimeSettings): CollectorRegistry {
  const registry = new CollectorRegistry();

  if (!settings.collectorsEnabled) {
    return registry;
  }

  const configuration = {
    serverId: settings.serverId,
    enabled: true,
    mode: settings.mode,
    ...(settings.logFile ? { logFile: settings.logFile } : {}),
    ...(settings.journalServiceName ? { journalServiceName: settings.journalServiceName } : {}),
    ...(settings.restHost ? { restHost: settings.restHost } : {}),
    ...(settings.restPort ? { restPort: settings.restPort } : {}),
    ...(settings.restUsername ? { restUsername: settings.restUsername } : {}),
    ...(settings.restPassword ? { restPassword: settings.restPassword } : {}),
    ...(settings.restPath ? { restPath: settings.restPath } : {})
  };

  if (settings.game === 'valheim') {
    registry.register(new ValheimCollector(configuration));
  } else if (settings.game === 'palworld') {
    registry.register(new PalworldCollector(configuration));
  }

  return registry;
}

export class ValheimCollectorShadowMode {
  private readonly collector: ValheimCollector;
  private readonly backfillLines: number;
  private lastRunAt: string | null = null;
  private lastDurationMs: number | null = null;
  private eventCount = 0;
  private lastEventTypes: string[] = [];
  private lastError: string | null = null;
  private parityStatus: ValheimCollectorShadowParityStatus = 'not_run';
  private totalCollectedEvents = 0;

  public constructor(collector: ValheimCollector, input: {
    backfillLines?: number | undefined;
  } = {}) {
    this.collector = collector;
    this.backfillLines = Math.max(0, Math.floor(input.backfillLines ?? 0));
  }

  public async run(input: {
    oldPathEvents?: NormalizedEvent[] | undefined;
    collect?: (() => Promise<NormalizedEvent[]> | NormalizedEvent[]) | undefined;
  }): Promise<void> {
    const startedAtMs = Date.now();
    this.lastRunAt = new Date(startedAtMs).toISOString();

    try {
      const collected = await (input.collect ? input.collect() : this.collector.collect());
      const collectedTypes = eventTypes(collected);
      const durationMs = Date.now() - startedAtMs;

      this.lastDurationMs = Math.max(0, Math.floor(durationMs));
      this.eventCount = collected.length;
      this.lastEventTypes = collectedTypes;
      this.lastError = null;
      this.parityStatus = resolveParityStatus({
        collectedTypes,
        oldPathEvents: input.oldPathEvents
      });
      this.totalCollectedEvents += collected.length;
    } catch (error) {
      const durationMs = Date.now() - startedAtMs;
      this.lastDurationMs = Math.max(0, Math.floor(durationMs));
      this.eventCount = 0;
      this.lastEventTypes = [];
      this.lastError = error instanceof Error ? error.message : String(error);
      this.parityStatus = 'error';
    }
  }

  public async runForJournalLine(line: string, oldPathEvents: NormalizedEvent[]): Promise<void> {
    await this.run({
      oldPathEvents,
      collect: () => this.collector.collectJournalLine(line)
    });
  }

  public async runBackfill(): Promise<void> {
    if (this.backfillLines <= 0) {
      return;
    }

    await this.run({
      collect: () => this.collector.collectBackfillLines(this.backfillLines)
    });
  }

  public async runScheduled(): Promise<void> {
    if (this.backfillLines > 0 && this.collector.configuration.mode === 'journal') {
      await this.runBackfill();
      return;
    }

    await this.run({});
  }

  public health(): CollectorHealth {
    return {
      collectorId: `${this.collector.collectorId}:shadow`,
      name: 'Valheim Collector Shadow',
      game: 'valheim',
      enabled: true,
      lastSuccessfulCollectionAt: this.lastError ? null : this.lastRunAt,
      lastError: this.lastError,
      lastCollectionDurationMs: this.lastDurationMs,
      totalEventsEmitted: this.totalCollectedEvents,
      shadow: {
        enabled: true,
        lastRunAt: this.lastRunAt,
        lastDurationMs: this.lastDurationMs,
        eventCount: this.eventCount,
        eventTypes: this.lastEventTypes,
        lastError: this.lastError,
        parityStatus: this.parityStatus
      }
    };
  }
}

export function createValheimCollectorShadow(settings: ValheimCollectorShadowSettings): ValheimCollectorShadowMode | null {
  if (!settings.enabled || settings.game !== 'valheim') {
    return null;
  }

  return new ValheimCollectorShadowMode(new ValheimCollector({
    serverId: settings.serverId,
    enabled: true,
    mode: settings.mode,
    label: 'Valheim Collector Shadow',
    ...(settings.backfillLines !== undefined ? { shadowBackfillLines: settings.backfillLines } : {}),
    includeOperationalEventCategories: true,
    ...(settings.logFile ? { logFile: settings.logFile } : {}),
    ...(settings.journalServiceName ? { journalServiceName: settings.journalServiceName } : {})
  }), {
    backfillLines: settings.backfillLines
  });
}

export function createCollectorRunner(registry: CollectorRegistry): CollectorRunner {
  return new CollectorRunner({
    registry,
    forwardEvents: (_events: NormalizedEvent[]) => {
      // Collector event forwarding is intentionally disabled until real collectors are migrated.
    }
  });
}

export function getValheimCollectorShadowHealthForHeartbeat(shadow: ValheimCollectorShadowMode | null): CollectorHealth[] {
  if (!shadow) {
    return [];
  }

  try {
    return [shadow.health()];
  } catch {
    return [];
  }
}

export function getCollectorHealthForHeartbeat(runner: Pick<CollectorRunner, 'health'> | null): CollectorHealth[] {
  if (!runner) {
    return [];
  }

  try {
    return runner.health();
  } catch {
    return [];
  }
}

export function buildConnectorHeartbeatPayload(input: ConnectorHeartbeatBuildInput): ConnectorHeartbeat {
  return connectorHeartbeatRequestSchema.parse({
    serverId: input.serverId,
    game: input.game,
    connectorMode: input.mode,
    observedAt: input.observedAt,
    status: input.status,
    message: input.message,
    lastSuccessfulPollAt: input.lastSuccessfulPollAt,
    consecutiveFailureCount: input.consecutiveFailureCount,
    capabilities: input.capabilities,
    collectors: input.collectors ?? []
  });
}
