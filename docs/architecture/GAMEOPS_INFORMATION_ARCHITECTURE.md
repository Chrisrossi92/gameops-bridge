# GameOps Information Architecture

GameOps Bridge is organized around worlds first, then server-scoped workflows, then detail and debug layers.

Core hierarchy:

```text
Overview
-> Server Workspace
-> Community / Players / World / Operations
-> Detail drawers
-> Raw telemetry/debug references
```

This hierarchy keeps the product understandable as it grows from Valheim and Palworld into a broader multi-game operations platform.

## Global Overview

Purpose: Are my worlds healthy?

The Overview is the command center. It should give owners one high-confidence card per server or world and help them decide where to go next.

Each world card should include:

- server or world name
- game identity
- status
- players online
- active players this week
- latest activity
- quick entry into that world

The Overview should not show dense technical diagnostics, raw telemetry, or mixed per-server detail. It should not try to be the place where a user investigates a player, audits guild risk, or debugs collectors. Those jobs belong inside the selected server workspace.

Good Overview outcomes:

- The owner can see whether all worlds are okay.
- The owner can see which world has current activity.
- The owner can enter the right world quickly.
- Quiet healthy worlds still feel alive, not empty.

## Server Workspace

Purpose: How is this world?

Everything inside a server workspace must be scoped to the selected server. The workspace should never blend metrics from multiple servers unless a specific comparison feature has been intentionally designed.

Scope rules:

- When inside Valheim, no Palworld metrics should be visible.
- When inside Palworld, no Valheim metrics should be visible.
- Shared platform components should receive the selected server as context.
- Empty states should describe the selected server, not the whole platform.
- Operations diagnostics should describe the selected server pipeline unless explicitly labeled global.

Shared shell structure:

- world header
- summary strip
- primary sections
- technical/operations section
- drawers and details

The world header should establish where the owner is: game, world/server name, current status, and the most important current activity. The summary strip should provide quick confidence without becoming a dense dashboard.

## Shared Server Sections

### Community

Purpose: How is the community doing?

Community summarizes the people-level rhythm of the selected world. It should favor readable owner language over analytics terminology.

Useful content:

- returning players
- recently active players
- quiet players
- peak hours
- seven-day snapshot
- seven-day comparison
- lightweight notable changes

Community should not invent health scores or churn predictions. Comparisons should be factual, explainable, and based on known sessions or validated activity.

### Players

Purpose: Who is playing, and what do we know about them?

Players should provide a player intelligence table and detail drawer. The table should support scanning and owner action; the drawer should support investigation without losing workspace context.

Useful content:

- player display name
- online/offline status
- recent sessions
- playtime
- first seen and last seen
- identity confidence
- game-specific player facts when available

Player detail drawers should preserve context. Opening a player should not force the owner away from the world workspace unless a deeper route is intentionally required later.

### World

Purpose: What has happened in this world?

World is the place for game-specific history and intelligence. It should be shared at the IA level, but each game can define the content that makes sense for its model.

Useful content:

- game-specific world history
- notable events
- trusted World Events
- progression-related facts when available
- future game-specific intelligence

World should avoid generic analytics when the game has stronger native concepts. A Valheim world history surface and a Palworld guild/base surface should not be forced to look identical.

World Events should appear as readable world history, not raw telemetry. Surfaces can rank the most meaningful trusted events first, but lower-signal events should remain available through trusted records, Chronicle links, or future history surfaces instead of being discarded.

### Operations

Purpose: Is the technical pipeline healthy?

Operations is the home for technical confidence and future owner controls. It should be accessible, accurate, and visually quieter than the primary owner-facing sections.

Useful content:

- collector status
- log truth
- session health
- pipeline health
- connector freshness
- configuration warnings
- raw references or debug links
- future restart/start/stop/backups controls

Operations can use technical language where precision matters. It should not be the first thing an owner sees when they only want to know whether the world is okay.

## Valheim Workspace

Valheim should emphasize characters, world history, and server events.

Primary sections:

- Community
- Players
- Characters
- World History
- Operations

Near-term and future focus:

- imported character detection
- new character detection
- character recency
- boss or world progression if available
- deaths if available
- settlements or world events if available

Valheim should feel scoped to the selected world. If the data comes from logs or imported files, the UI should state the confidence level plainly instead of overclaiming.

## Palworld Workspace

Palworld should emphasize players, guilds, bases, and world risk.

Primary sections:

- Community
- Players
- Guilds
- Bases/World later
- Operations

Near-term and future focus:

- guild activity
- guild member recency
- base deletion risk based on inactivity and the 30-day base deletion setting
- new guilds
- active and inactive guilds
- player-to-guild context where available

Palworld guild and base concepts should not leak into Valheim or other game workspaces. They should be platform extensions scoped to Palworld.

## Detail Drawers

Detail drawers preserve context. They should be preferred for investigation flows that start from a table, card, event, or activity item.

Good drawer uses:

- player profile
- guild profile
- session timeline
- recent activity details
- event evidence
- World Event connected history
- identity confidence explanation
- pipeline diagnostic detail

Drawers should answer a focused question and provide enough evidence for trust. They should not become miniature full pages with unrelated sections.

World Event drawers should preserve the selected world context while showing source, confidence, occurred and discovered timestamps, evidence, and connected history such as related memories, people, guilds, characters, and related events.

## Raw Telemetry And Debug References

Raw telemetry is a trust and debugging layer. It should be available to advanced users and implementation agents, but it should not be the primary product surface.

Appropriate raw/debug content:

- original event payloads
- log references
- collector timestamps
- identity resolution evidence
- ingestion health
- request or connector diagnostics

Raw references should be reachable from Operations or detail evidence, not from the top-level Overview.

## Navigation Rules

- Overview is the command center.
- Clicking a server enters that server workspace.
- Server workspace tabs and sections must preserve server scope.
- Technical diagnostics should be accessible but visually quieter.
- Detail drawers should preserve context instead of forcing full page navigation when possible.
- Game-specific sections should appear only for games that support them.
- Cross-game comparison should be an explicit future feature, not an accidental side effect of shared components.

## Implementation Standard

When adding or changing a screen, identify its place in the hierarchy before implementing it:

- Global Overview: all worlds, high-confidence summary only.
- Server Workspace: one selected world, owner-facing operations.
- Section: one topic inside the selected world.
- Detail drawer: one entity or event in context.
- Raw/debug reference: technical evidence and troubleshooting.

If the screen does not fit one of these layers, the IA probably needs to be clarified before implementation.
