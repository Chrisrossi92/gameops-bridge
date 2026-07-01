import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameKey, NormalizedEvent } from '@gameops/shared';
import { BaseCollector } from './base.js';
import { CollectorRegistry } from './registry.js';
import { CollectorRunner } from './runner.js';
import { PalworldCollector } from './palworld.js';
import { ValheimCollector } from './valheim.js';
import type { CollectorConfiguration } from './types.js';

function createEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    game: 'valheim',
    serverId: 'srv-collector',
    eventType: 'SERVER_ONLINE',
    occurredAt: '2026-07-01T12:00:00.000Z',
    message: 'collector event',
    ...overrides
  };
}

class FakeCollector extends BaseCollector {
  private readonly events: NormalizedEvent[];
  private readonly failure: Error | null;

  public constructor(input: {
    collectorId: string;
    game?: GameKey;
    enabled?: boolean;
    events?: NormalizedEvent[];
    failure?: Error;
  }) {
    const game = input.game ?? 'valheim';
    const configuration: CollectorConfiguration = {
      serverId: 'srv-collector',
      enabled: input.enabled ?? true,
      mode: 'test',
      label: input.collectorId
    };

    super({
      collectorId: input.collectorId,
      name: input.collectorId,
      game,
      configuration
    });

    this.events = input.events ?? [];
    this.failure = input.failure ?? null;
  }

  public collect(): NormalizedEvent[] {
    if (this.failure) {
      throw this.failure;
    }

    return this.events;
  }
}

test('registry registers collectors and rejects duplicate ids', () => {
  const registry = new CollectorRegistry();
  const valheim = new ValheimCollector({
    serverId: 'valheim-1',
    enabled: true,
    mode: 'journal'
  });

  registry.register(valheim);

  assert.equal(registry.get(valheim.collectorId), valheim);
  assert.deepEqual(registry.list().map((collector) => collector.collectorId), ['valheim:valheim-1:journal']);
  assert.throws(() => registry.register(valheim), /already registered/);
});

test('registry can hold multiple placeholder collectors', () => {
  const registry = new CollectorRegistry();
  registry.register(new ValheimCollector({ serverId: 'valheim-1', enabled: true, mode: 'journal' }));
  registry.register(new PalworldCollector({ serverId: 'palworld-1', enabled: false, mode: 'rest' }));

  assert.deepEqual(registry.list().map((collector) => collector.game), ['valheim', 'palworld']);
  assert.deepEqual(registry.enabled().map((collector) => collector.game), ['valheim']);
  assert.equal(registry.health()[1]?.enabled, false);
});

test('empty collectors run successfully without forwarding events', async () => {
  const registry = new CollectorRegistry();
  registry.register(new ValheimCollector({ serverId: 'valheim-1', enabled: true, mode: 'journal' }));
  const forwarded: NormalizedEvent[] = [];
  const runner = new CollectorRunner({
    registry,
    forwardEvents: (events) => {
      forwarded.push(...events);
    }
  });

  const results = await runner.runOnce();

  assert.equal(results.length, 1);
  assert.equal(results[0]?.ok, true);
  assert.equal(results[0]?.emitted, 0);
  assert.equal(forwarded.length, 0);
  assert.equal(runner.health()[0]?.lastError, null);
  assert.equal(runner.health()[0]?.totalEventsEmitted, 0);
});

test('runner forwards successful collector events', async () => {
  const registry = new CollectorRegistry();
  registry.register(new FakeCollector({
    collectorId: 'collector-forward',
    events: [
      createEvent({ id: 'forwarded-1' }),
      createEvent({ id: 'forwarded-2', occurredAt: '2026-07-01T12:01:00.000Z' })
    ]
  }));
  const forwarded: NormalizedEvent[] = [];
  const runner = new CollectorRunner({
    registry,
    forwardEvents: (events) => {
      forwarded.push(...events);
    }
  });

  const results = await runner.runOnce();

  assert.equal(results[0]?.ok, true);
  assert.equal(results[0]?.emitted, 2);
  assert.deepEqual(forwarded.map((event) => event.id), ['forwarded-1', 'forwarded-2']);
  assert.equal(runner.health()[0]?.totalEventsEmitted, 2);
  assert.match(runner.health()[0]?.lastSuccessfulCollectionAt ?? '', /^2026|^\d{4}/);
});

test('runner isolates collector failures and continues with later collectors', async () => {
  const registry = new CollectorRegistry();
  registry.register(new FakeCollector({
    collectorId: 'collector-fails',
    failure: new Error('collector exploded')
  }));
  registry.register(new FakeCollector({
    collectorId: 'collector-succeeds',
    events: [createEvent({ id: 'after-failure' })]
  }));
  const forwarded: NormalizedEvent[] = [];
  const runner = new CollectorRunner({
    registry,
    forwardEvents: (events) => {
      forwarded.push(...events);
    }
  });

  const results = await runner.runOnce();
  const health = runner.health();

  assert.equal(results.length, 2);
  assert.equal(results[0]?.ok, false);
  assert.match(results[0]?.error ?? '', /collector exploded/);
  assert.equal(results[1]?.ok, true);
  assert.deepEqual(forwarded.map((event) => event.id), ['after-failure']);
  assert.match(health[0]?.lastError ?? '', /collector exploded/);
  assert.equal(health[1]?.totalEventsEmitted, 1);
});

test('runner records forwarding failures as collector failures', async () => {
  const registry = new CollectorRegistry();
  registry.register(new FakeCollector({
    collectorId: 'collector-forward-fails',
    events: [createEvent({ id: 'cannot-forward' })]
  }));
  const runner = new CollectorRunner({
    registry,
    forwardEvents: () => {
      throw new Error('ingest unavailable');
    }
  });

  const results = await runner.runOnce();
  const health = runner.health()[0];

  assert.equal(results[0]?.ok, false);
  assert.equal(results[0]?.emitted, 0);
  assert.match(results[0]?.error ?? '', /ingest unavailable/);
  assert.match(health?.lastError ?? '', /ingest unavailable/);
  assert.equal(health?.totalEventsEmitted, 0);
});
