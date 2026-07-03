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

## UI Foundation

The current UI scope is an internal preview renderer only. It demonstrates the contract, source attribution, evidence counts, timestamps, confidence, and significance without adding navigation, notifications, analytics, collector behavior, telemetry changes, or AI.

Future production surfaces should consume this domain model instead of rebuilding separate event shapes.
