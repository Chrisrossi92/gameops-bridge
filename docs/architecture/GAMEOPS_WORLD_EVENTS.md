# GameOps World Events

World Events are the reusable domain layer for answering one question:

What happened to this world?

They are not telemetry packets, collector ticks, Discord messages, or AI summaries. Those systems can become sources or evidence later, but the World Event itself must describe a world-level change.

## Contract

The shared `WorldEvent` contract lives in `@gameops/shared` and supports:

- stable event identity and `worldId`
- world-level event type
- title and summary
- occurred and discovered timestamps
- confidence
- significance
- source attribution
- evidence references
- related world events
- related memories, players, guilds, and characters
- metadata for future game-specific expansion

Fields can remain empty until trusted data exists. The contract is intentionally broader than the current UI so Chronicle, Living Timeline, World History, Community Pulse, Discord Chronicle, Operator Journal, and future AI summaries can consume the same shape later.

## Event Types

Initial shared event types are world concepts:

- boss defeated
- settlement founded
- trader discovered
- portal network expanded
- guild created
- base abandoned
- expedition launched
- world state changed
- community milestone
- custom

Raw implementation events such as player connections, collector ticks, packet arrivals, and guild refreshes are not World Events by themselves.

## Source And Evidence

Every World Event has a source:

- Session Engine
- World Memory
- Collector
- Chronicle
- Manual Operator Entry
- Discord integration
- AI consumer
- System

Sources explain where the event originated. Evidence references explain why the event is trusted. Evidence may point to log truth entries, sessions, memory records, Chronicle entries, operator notes, or external references.

Source, confidence, occurred timestamp, discovered timestamp, and evidence are not optional UI concerns. Any production surface that renders a World Event must keep them visible or inspectable so an owner can understand why the system believes the event happened.

## Significance

World Events use reusable significance levels:

- minor
- normal
- major
- historic

Significance is for future history presentation, not alerting. A historic event should help the Chronicle or Living Timeline emphasize a meaningful world moment. It must not create notifications by itself.

## Registry

The web foundation includes a `WorldEventRegistry` that:

- scopes events to one world
- sorts events by `occurredAt`
- looks up events by id, type, and significance
- resolves related event links
- filters events by related memories, players, guilds, and characters

The registry does not generate events. Future adapters can feed it trusted events from World Memory, Chronicle, manual operator entry, or other sources.

## Chronicle Integration

Chronicle may adapt trusted World Events into readable Chronicle entries. That adapter must preserve the World Event id, source, confidence, occurred and discovered timestamps, related memories, and evidence references.

Chronicle integration must not create new World Events or invent missing history. It can render trusted events, sort them with existing Chronicle entries, and expose evidence in owner-friendly language.

World Events now also derive deterministically from trusted World Memory and Chronicle records. The derivation layer uses records that already exist in the selected world's memory registry. It does not read raw collectors, create telemetry, or infer unsupported history. Chronicle-derived events must include Chronicle evidence. Memory-derived events must include memory evidence when a memory record is available.

Preview World Events are development fallbacks only. They must never mask real trusted records. When trusted World Memory or Chronicle records exist for the selected world, production surfaces should prefer those records and suppress seeded preview events.

## Relevance And Noise Control

World Events can be ranked for presentation, but ranking must not delete or rewrite trusted events.

The current relevance layer is deterministic and favors:

- historic and major significance
- higher confidence
- attached evidence
- related memory and entity references
- game-meaningful lifecycle or progression records

Lower-signal events such as routine joins, leaves, returns, and server restart or online records should be quieter when stronger world history exists. They may still be shown when they are the only trusted history available.

Relevance is a presentation rule, not a truth rule. The full trusted event set should remain available to detail views, Chronicle links, future timelines, or future history surfaces.

## Detail Inspection

World Event detail views are read-only trust surfaces.

They should show:

- title and summary
- event type and significance
- confidence
- source
- occurred and discovered timestamps
- evidence references
- connected history

Connected history includes related memories, people, guilds, characters, and related World Events when those fields are already present on the event. The UI may resolve related event titles from the selected event list, but it must not invent relationships or make unsupported targets clickable.

## UI Foundation

The current UI includes Chronicle integration, a World Events overview section, and a read-only detail drawer. It demonstrates the contract, source attribution, evidence counts, timestamps, confidence, significance, relevance labels, and connected history without adding navigation, notifications, analytics, collector behavior, telemetry changes, or AI.

Future production surfaces should consume this domain model instead of rebuilding separate event shapes.

## Phase 8 Guardrails

Phase 8 created the World Event foundation only. It did not introduce AI-generated history, notification systems, Discord posting, collector changes, telemetry changes, predictions, manual event creation, or world scoring.

Future AI consumers may read trusted World Events as context, but AI must not become a source of world history unless a future architecture explicitly defines provenance, confidence, evidence, and owner review rules.
