import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldEvent } from '@gameops/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { selectChronicleWorldEvents } from '../src/world-events.ts';
import {
  WorldEventDetailDrawer,
  WorldEventRelationshipSummary,
  WorldEventRenderer,
  WorldHistoryTimeline
} from '../src/world-event-renderer.tsx';

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

test('world history timeline uses trusted history language and exposes evidence inspection', () => {
  const html = renderToStaticMarkup(<WorldHistoryTimeline events={[event()]} onSelect={() => undefined} />);

  assert.match(html, /World History/);
  assert.match(html, /Trusted events from Chronicle and World Memory/);
  assert.match(html, /A new settlement was established/);
  assert.match(html, /World Memory/);
  assert.match(html, /0 evidence/);
  assert.match(html, /Inspect evidence/);
});

test('world history timeline orders selected rows by occurred time without mutating input', () => {
  const older = event({ id: 'older', title: 'Older world event', occurredAt: '2026-07-01T10:00:00.000Z' });
  const newer = event({ id: 'newer', title: 'Newer world event', occurredAt: '2026-07-01T12:00:00.000Z' });
  const events = [older, newer];
  const snapshot = structuredClone(events);
  const html = renderToStaticMarkup(<WorldHistoryTimeline events={events} />);

  assert.ok(html.indexOf('Newer world event') < html.indexOf('Older world event'));
  assert.deepEqual(events, snapshot);
});

test('world history timeline can render relevance-controlled selected events', () => {
  const selected = selectChronicleWorldEvents([
    event({ id: 'routine', title: 'Routine arrival', significance: 'minor', confidence: 'high' }),
    event({ id: 'major', title: 'A major world event', significance: 'major', confidence: 'medium' })
  ], { maxEvents: 1 });
  const html = renderToStaticMarkup(
    <WorldHistoryTimeline events={selected.events} totalEventCount={selected.totalEvents} />
  );

  assert.match(html, /A major world event/);
  assert.doesNotMatch(html, /Routine arrival/);
  assert.match(html, /showing 1 of 2 trusted events/);
});

test('world history timeline shows an owner-friendly empty state', () => {
  const html = renderToStaticMarkup(<WorldHistoryTimeline events={[]} />);

  assert.match(html, /This world does not have enough trusted history yet/);
});

test('world event renderer remains a compatibility wrapper for the timeline', () => {
  const html = renderToStaticMarkup(<WorldEventRenderer events={[event()]} />);

  assert.match(html, /World History/);
  assert.match(html, /Trusted events from Chronicle and World Memory/);
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

test('world event detail drawer displays connected history with owner-friendly labels', () => {
  const html = renderToStaticMarkup(
    <WorldEventDetailDrawer
      event={event({
        relatedEvents: [{
          eventId: 'event:portal',
          relationshipType: 'followed_by',
          confidence: 'medium',
          sourceLabel: 'World Memory'
        }]
      })}
      relatedEvents={[event({
        id: 'event:portal',
        title: 'Portal network expanded',
        summary: 'The portal network expanded.'
      })]}
      onClose={() => undefined}
    />
  );

  assert.match(html, /Connected history/);
  assert.match(html, /Connected to 5 trusted references/);
  assert.match(html, /Memory reference: memory:settlement/);
  assert.match(html, /Player reference: player:chris/);
  assert.match(html, /Guild reference: guild:iron-wolves/);
  assert.match(html, /Character reference: character:chris/);
  assert.match(html, /Related event: Portal network expanded/);
});

test('world event relationship summary names missing relationships clearly', () => {
  const html = renderToStaticMarkup(
    <WorldEventRelationshipSummary
      event={event({
        relatedEvents: [],
        relatedMemories: [],
        relatedPlayers: [],
        relatedGuilds: [],
        relatedCharacters: []
      })}
    />
  );

  assert.match(html, /No connected world history is recorded yet/);
  assert.match(html, /No related memories recorded yet/);
  assert.match(html, /No related people recorded yet/);
  assert.match(html, /No related guilds recorded yet/);
  assert.match(html, /No related characters recorded yet/);
  assert.match(html, /No related events recorded yet/);
});

test('world event relationship summary falls back to related event ids when titles are unavailable', () => {
  const html = renderToStaticMarkup(
    <WorldEventRelationshipSummary
      event={event({
        relatedEvents: [{
          eventId: 'event:missing',
          relationshipType: 'related_to',
          confidence: 'low',
          sourceLabel: 'World Memory'
        }],
        relatedMemories: [],
        relatedPlayers: [],
        relatedGuilds: [],
        relatedCharacters: []
      })}
      relatedEvents={[]}
    />
  );

  assert.match(html, /Related event: event:missing/);
});

test('world event detail drawer names missing evidence clearly', () => {
  const html = renderToStaticMarkup(
    <WorldEventDetailDrawer event={event({ evidence: [] })} onClose={() => undefined} />
  );

  assert.match(html, /No evidence references are attached yet/);
});
