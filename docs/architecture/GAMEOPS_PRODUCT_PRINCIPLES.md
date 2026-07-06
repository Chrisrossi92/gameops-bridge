# GameOps Product Principles

GameOps Bridge is a game server operations platform. It is not a telemetry dashboard with charts attached to it.

The product exists to help server owners understand their worlds, players, communities, and operational risk. Telemetry, collectors, log truth, identity resolution, RCON, REST, and pipeline health are important platform capabilities, but they are supporting infrastructure. They should be available when needed without becoming the visual center of the product.

## North Star

GameOps Bridge should become more valuable to a server owner each sprint, not merely more technically sophisticated.

Infrastructure work is valuable when it makes owner-facing workflows more trustworthy, more useful, safer, or easier to operate. A technically impressive feature that does not help an owner answer a real operational question should not dominate the roadmap.

## Worlds Before Technology

Users think in worlds, servers, players, guilds, communities, characters, bases, and events.

The product should organize itself around those nouns first:

- worlds and servers
- online players
- returning players
- guilds and bases where the game supports them
- character and world history where the game supports them
- notable activity
- owner actions

Technical concepts belong behind this layer:

- collectors
- log truth
- telemetry ingestion
- RCON
- REST
- identity resolution
- session health
- pipeline health
- raw events

These technical concepts are not hidden. They are necessary for trust and debugging. They should live in Operations, detail views, and raw telemetry references instead of competing with the owner-facing state of the world.

## Owner Questions

Server owners open GameOps Bridge to answer a small set of practical questions:

- Is everything okay?
- Who is online?
- Did anything interesting happen?
- How is my community doing?
- Do I need to take action?

Every primary screen should answer three questions quickly:

- What is happening now?
- What changed since I was last here?
- Do I need to do anything?

If a screen cannot answer these questions, it probably needs a clearer job, less technical noise, or a lower position in the hierarchy.

## Calm By Default

Healthy systems should feel quiet, confident, and rewarding.

GameOps Bridge should not feel like a warning-heavy infrastructure dashboard where every metric is red, yellow, or green. Most owner visits should confirm that the worlds are alive, the community is understandable, and nothing needs urgent intervention.

Use warnings and errors sparingly:

- A warning should mean an owner may need to pay attention.
- An error should mean something important is broken or untrustworthy.
- A healthy state should be allowed to look calm instead of visually empty.
- Absence of data should be honest and specific, not inflated into fake insight.

## Progressive Disclosure

The product should move from owner-facing clarity to technical depth in layers:

1. Overview
2. Server workspace
3. Section
4. Drawer or detail view
5. Raw telemetry or debug reference

The top layers should be useful without requiring the user to understand the pipeline. Deeper layers should preserve enough technical context for debugging, support, and future operator workflows.

## One Job Per Screen

Each major surface should have one clear responsibility:

- Overview answers: How are all my worlds?
- Server workspace answers: How is this world?
- Player detail answers: Tell me about this player.
- Guild detail answers: Tell me about this guild.
- World history answers: What has happened in this world?
- Operations answers: Is the technical pipeline healthy?

Avoid mixed-purpose screens that combine global health, per-server community detail, player investigation, and collector diagnostics in the same visual priority. If a screen has too many jobs, split the work into sections, drawers, or an Operations surface.

## Trusted World History

World history should be built from trusted records, not generated narrative.

World Events, Chronicle entries, and future timelines must preserve why a claim is shown: source, confidence, timing, evidence, and connected history. Relevance or noise control can decide what appears first, but it must not delete trusted history or hide the provenance needed for owner trust.

AI-generated history is out of bounds until a future architecture explicitly defines source attribution, evidence, confidence, review, and correction rules.

## Plain Language

Prefer owner-friendly product language:

- Recent Activity
- Players
- Community
- World History
- Server Status
- Online now
- Active this week
- Last activity
- Recent sessions
- Guild activity

Avoid primary placement of developer or pipeline language:

- collector heartbeat
- ingestion
- RCON
- REST
- identity resolution
- log truth
- pipeline health

Those terms are allowed in Operations and debug contexts, where precision matters more than first-glance readability.

## Game-Specific Concepts Stay Game-Specific

GameOps Bridge is a multi-game platform, not a one-size-fits-all dashboard.

Shared concepts should remain shared:

- server status
- online players
- recent activity
- sessions
- community activity
- technical operations

Game-specific concepts should stay attached to the games that make them meaningful:

- Palworld should use guild, member, base, and world-risk language.
- Valheim should use character, world history, progression, and event language.
- Future Minecraft support can introduce block, world, player, settlement, or realm-specific concepts without redesigning the platform.
- Future Rust support can introduce industrial, survival, clan, base, wipe, and raid concepts without forcing those concepts onto other games.
- Future Enshrouded support can add its own world and player concepts without diluting Valheim or Palworld.

When inside a Valheim workspace, Palworld metrics should not be visible. When inside a Palworld workspace, Valheim metrics should not be visible. Cross-game reuse should happen through platform primitives, not through visually mixing game-specific language.

## No Fake Analytics

GameOps Bridge should not invent intelligence before the factual foundation supports it.

Do not add churn scores, engagement scores, AI recommendations, unexplained health rankings, or predictive claims until the source data, calculation, and owner value are explicit. Early intelligence should be grounded in facts the system already trusts:

- known sessions
- online status
- player recency
- player activity windows
- durable log truth
- server health
- collector state
- game-specific telemetry that has been validated

It is better to say "No recent sessions found" than to invent a story about community risk. It is better to show "Identity confidence is low" than to pretend the player profile is certain.

## Implementation Standard

Future implementation work should be judged by these questions:

- Does this make the product more useful to a real server owner?
- Does the primary screen speak in world, player, community, or event language?
- Is the technical layer still available without becoming visually primary?
- Does the screen have one clear job?
- Are game-specific concepts scoped to the right game?
- Are claims backed by validated data?
- Does the healthy path feel calm?

If the answer to these questions is unclear, prefer a smaller factual feature over a broader speculative one.
