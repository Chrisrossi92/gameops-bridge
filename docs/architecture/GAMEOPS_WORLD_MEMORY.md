# GameOps World Memory

World Memory is the platform layer that turns trusted world evidence into remembered world objects.

Telemetry records what happened. World Memory records what the product can safely remember from those facts: people, characters, guilds, bases, world events, and future game-specific entities.

World Memory is not AI, summarization, prediction, or analytics. It does not fabricate history. Every memory must be grounded in existing trusted data.

## Purpose

World Memory gives GameOps Bridge one durable architecture for remembering important things across games.

It supports current and future product surfaces:

- World Chronicle
- entity detail drawers
- future world search
- future entity timelines
- future relationship views
- future AI context, if AI is intentionally introduced later

The product should continue speaking in world language. Internally, memory records can use generic types, but owners should see characters, guilds, bases, clans, villages, and world history.

## Architecture

World Memory has three core concepts:

- Memory records
- Relationships
- Chronicle references

A registry exposes those concepts to the UI. The registry is the single source of truth for remembered objects in the selected world. Game modules provide trusted data into the registry; shared platform components consume the registry output.

```text
Trusted data
-> Game memory adapter
-> World Memory registry
-> Chronicle / Drawers / Future Search / Future Timelines
```

Current adapters:

- Valheim: character memories from Player Intelligence, known players, sessions, and trusted events.
- Palworld: guild and member memories from guild activity, matched player activity, and base lifecycle evidence.

Future adapters can add Minecraft villages, Rust clans, Enshrouded settlements, bosses, bases, or other game-specific concepts without changing the shared registry contract.

## Memory Records

Every remembered object should eventually support:

- display name
- type
- first seen
- last seen
- current status
- confidence
- Chronicle references
- relationships
- future timeline

Initial record types include:

- person
- character
- guild
- base
- world event
- settlement
- boss
- village
- clan

Records are not user-facing by default. Product surfaces choose the appropriate language and level of detail.

## Memory Lifecycle

Memory records are created when trusted existing data supports them.

Examples:

- A Valheim character can be remembered when Player Intelligence has a trusted player record.
- A Palworld guild can be remembered when parsed guild activity identifies a guild.
- A Palworld member relationship can be remembered when a guild member is matched to tracked player activity.

Records can become richer as more evidence arrives. They should not be upgraded by guesswork.

If a field is not supported by current data, it remains absent or unknown. The UI should explain missing evidence plainly instead of inventing values.

## Relationship Philosophy

Relationships are lightweight links between memory records.

Examples:

- Player -> Character
- Character -> Realm
- Guild -> Members
- Guild -> Bases
- Base -> World

Relationships should include confidence and source labels. They do not need rich UI immediately. Their first job is to prevent every feature from rebuilding entity lookups independently.

## Chronicle Integration

World Chronicle consumes Chronicle events produced by World Memory.

The Chronicle should still read like a story:

- Chris entered the realm.
- A guild showed activity.
- A guild became quiet.

The UI should not expose raw memory implementation details. Memory gives Chronicle stable entity references, confidence, and source labels behind the scenes.

When a Chronicle event is tied to a memory record, detail drawers and future timelines can use that reference without text matching or duplicate lookup logic.

## Detail Drawer Foundation

Detail drawers should increasingly receive a memory detail model:

- record
- relationships
- chronicle events

Game-specific drawers can still render game-specific evidence, but the lookup path should flow through World Memory where possible.

This allows future drawers for bases, settlements, villages, clans, characters, or bosses to share the same foundation while keeping game-specific language.

## Cross-Game Compatibility

World Memory is intentionally generic at the platform layer and specific at the adapter layer.

Shared platform concepts:

- record identity
- record type
- first seen / last seen
- status
- confidence
- relationships
- Chronicle references

Game-specific concepts:

- Valheim imported character signals
- Palworld guild activity and base lifecycle
- Minecraft village or resident concepts
- Rust clan, wipe, raid, or base concepts

New games should add adapters that translate trusted game data into memory records. They should not create isolated dashboard widgets that duplicate memory lookup logic.

## Guardrails

World Memory must not:

- invent entities
- infer unsupported relationships
- summarize with AI
- create hidden scores
- change collectors, telemetry, APIs, or session semantics

World Memory may:

- normalize trusted data into reusable records
- attach confidence and source labels
- preserve relationships for future UI
- provide Chronicle events with stable references

## Implementation Standard

When adding a new world-facing feature, ask:

- Is this a new kind of memory?
- Which trusted data creates it?
- What confidence should it carry?
- What relationships does it expose?
- Should Chronicle, drawers, search, or future timelines consume it?

If the answer is yes, add the memory adapter first, then build the UI on top.
