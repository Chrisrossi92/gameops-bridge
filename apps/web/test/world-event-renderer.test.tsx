import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorldEventDetailDrawer, WorldEventRenderer } from '../src/world-event-renderer.tsx';

function event(overrides: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: overrides.id ?? 'event',
    worldId: overrides.worldId ?? 'world',
    eventType: overrides.eventType ?? 'settlement_founded',
    title: overrides.title ?? 'A new settlement',
    summary: overrides.summary ?? 'A new settlement was established.',
    occurredAt: overrides.occurredAt ?? '2026-07-01T10:00:00.000Z',
    discoveredAt: overrides.discoveredAt ?? '2026-07-01T10:02:00.000Z',
    confidence: overrides.confidence ?? 'medium',
    significance: overrides.significance ?? 'major',
    source: overrides.source ?? { kind: 'world_memory', label: 'World Memory' },
    evidence: overrides.evidence ?? [],
    relatedEvents: overrides.relatedEvents ?? [],
    relatedMemories: overrides.relatedMemories ?? ['memory:settlement'],
    relatedPlayers: overrides.relatedPlayers ?? ['player:chris'],
    relatedGuilds: overrides.relatedGuilds ?? ['guild:iron-wolves'],
    relatedCharacters: overrides.relatedCharacters ?? ['character:chris'],
    metadata: overrides.metadata ?? {}
  };
}

test('world event renderer uses Chronicle language and opens from trusted entries', () => {
  const html = renderToStaticMarkup(<WorldEventRenderer events={[event()]} onSelect={() => undefined} />);

  assert.match(html, /World Events in the Chronicle/);
  assert.match(html, /Trusted world events are shown here as readable history/);
  assert.match(html, /A new settlement was established/);
  assert.match(html, /World Memory/);
  assert.match(html, /0 evidence/);
});

test('world event detail drawer preserves trust, evidence, and related history', () => {
  const html = renderToStaticMarkup(
    <WorldEventDetailDrawer
      event={event({
        evidence: [{
          id: 'evidence:note',
          type: 'operator_note',
          label: 'Operator note',
          sourceLabel: 'Manual Operator Entry',
          observedAt: '2026-07-01T10:02:00.000Z',
          metadata: {}
        }]
      })}
      onClose={() => undefined}
    />
  );

  assert.match(html, /Why this is shown/);
  assert.match(html, /Evidence/);
  assert.match(html, /Operator note/);
  assert.match(html, /Manual Operator Entry/);
  assert.match(html, /Related history/);
  assert.match(html, /memory:settlement/);
  assert.match(html, /player:chris/);
  assert.match(html, /guild:iron-wolves/);
  assert.match(html, /character:chris/);
  assert.match(html, /Recorded from World Memory/);
});

test('world event detail drawer names missing evidence clearly', () => {
  const html = renderToStaticMarkup(
    <WorldEventDetailDrawer event={event({ evidence: [] })} onClose={() => undefined} />
  );

  assert.match(html, /No evidence references are attached yet/);
});
