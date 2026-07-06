# GameOps Design System

GameOps Bridge should feel like a polished game operations center: premium, readable, game-inspired, calm, and confident.

It should not feel like a generic SaaS admin dashboard. It should carry living-world energy through hierarchy, game atmosphere, tactile controls, and restrained motion, without becoming noisy or decorative at the expense of operational clarity.

## Visual Personality

The interface should communicate:

- premium utility
- readable operational state
- game-specific atmosphere
- calm confidence
- living-world presence

The owner should feel that they are entering a real operations surface for real game worlds. Visual design should support quick scanning first, then richer inspection.

Avoid:

- chart walls
- warning-heavy dashboard language
- generic admin panels
- fake intelligence callouts
- decorative effects that compete with current state
- visual sameness across games when the game concepts are different

## Visual Hierarchy

### Level 1: Immediate State

Immediate state is the top visual priority.

Use it for:

- server/world health
- online players
- recent activity

These elements should be large, readable, and glanceable. A server owner should be able to understand the current state without parsing dense tables or technical labels.

### Level 2: Operational

Operational information supports daily server ownership.

Use it for:

- community
- players
- guilds
- characters
- world history
- seven-day snapshots
- notable activity

This level should be useful without explanation. Cards and tables should prioritize clear labels, readable density, and obvious next actions.

### Level 3: Investigative

Investigative views explain evidence and context.

Use it for:

- player drawer
- guild drawer
- session timeline
- event history
- identity confidence
- detail-level comparisons

These surfaces can be denser because the user has chosen to investigate. They should preserve context and make the source of claims visible.

### Level 4: Technical

Technical information supports trust, debugging, and operations.

Use it for:

- collectors
- log truth
- telemetry pipeline
- connector freshness
- raw events
- RCON and REST diagnostics

Technical information should be collapsed, compact, or visually quiet unless needed. It should be easy to find from Operations and evidence views, but it should not dominate the primary owner experience.

## Game-Specific Atmosphere

GameOps Bridge should use shared interaction patterns while allowing each game workspace to have its own atmosphere.

### Valheim

Valheim should feel warm, grounded, and saga-like.

Useful visual language:

- warm firelight
- dark wood
- iron accents
- rune-inspired details
- subtle ember motion
- heavier spacing and grounded surfaces

The Valheim workspace should support world history, character, and progression concepts without feeling like a generic table viewer.

### Palworld

Palworld should feel brighter, friendly, and energetic.

Useful visual language:

- brighter gradients
- rounded energetic cards
- friendly motion
- colorful creature-world accents
- readable guild and base surfaces

The Palworld workspace should make guild activity, member recency, and base risk feel approachable without hiding operational seriousness.

### Future Minecraft

Minecraft can use blocky geometry and earth, grass, and stone language.

This should appear through layout rhythm, iconography, surface treatments, and game-scoped accents, not by forcing every component into novelty shapes.

### Future Rust

Rust can use industrial steel, orange, survival, and wipe/raid language.

It should feel harsher and more utilitarian than Palworld while still fitting the shared GameOps shell.

## Motion Principles

Use subtle motion to communicate life, not distraction.

Good motion:

- healthy indicators can softly pulse
- drawers slide smoothly
- hover states feel tactile
- recent activity can update gently
- game atmosphere can move subtly in non-critical areas

Avoid:

- flashing alerts
- constant attention-grabbing animation
- animated metrics that make reading harder
- motion that implies urgency without a real urgent state

Respect reduced-motion preferences where support already exists. If the app does not yet support reduced motion consistently, treat that as a future design-system requirement before adding more animation-heavy surfaces.

## Color And Status

Healthy should feel calm and rewarding.

Warning and error states should be rare and meaningful. Avoid turning every metric into red/yellow/green anxiety. Use color to orient the user by game, world, and state.

Status guidance:

- Healthy: calm, confident, low-noise.
- Active: lively, clear, not urgent.
- Warning: visible, specific, and actionable.
- Error: reserved for broken or untrustworthy states.
- Unknown: honest, neutral, and explanatory.

Game color should not override status meaning. If a game workspace has a strong accent palette, reserve enough contrast and semantic consistency for status indicators.

## Language

Normalize owner-friendly language in primary UI.

Prefer:

- Online now
- Active this week
- Last activity
- Recent sessions
- World history
- Guild activity
- Players
- Community
- Server Status
- Recent Activity

Avoid primary placement of:

- collector heartbeat
- ingestion
- RCON
- REST
- identity resolution
- log truth
- telemetry pipeline

Those terms belong in Operations, debug views, detail evidence, and implementation-facing documentation.

## Component Guidance

### World Cards

World cards should feel like entering a world.

They should show the world name, game identity, state, online players, active players this week, and latest activity. They should be visually distinct enough to suggest the game or world, but not so decorative that the current state is hard to read.

### Summary Strips

Summary strips should be compact and confidence-building.

They should answer the immediate state questions at a glance: status, online now, recent activity, and the most important change. They should not become dense dashboards.

### Community Cards

Community cards should be readable without explanation.

They should use plain labels and factual comparisons. If the system does not have enough data, the empty state should say what is missing instead of inventing insight.

### Technical Cards

Technical cards should be compact and lower priority.

They can use precise technical labels, but they should live in Operations or secondary areas. Their visual treatment should signal utility and trust without competing with world and community state.

### Detail Drawers

Detail drawers should preserve context.

They should slide smoothly, keep the selected world visible, and focus on one entity or event. A player drawer should explain that player. A guild drawer should explain that guild. A session timeline should explain session evidence.

World Event drawers should make trust inspectable. They should show evidence, source, confidence, timestamps, and connected history in owner language such as "Connected history" and "Related memories." Empty relationship states should be honest and compact instead of hidden or inflated.

World History controls should stay compact and readable. Group headings and filters should use owner language such as "Today," "This week," "All history," "Meaningful," "Quiet," and "High confidence." Empty filtered states should explain the selected view plainly instead of exposing implementation details.

### Empty States

Empty states should be honest and useful.

Good empty states explain:

- what data is missing
- whether the state is expected
- what action, if any, can improve it

Bad empty states invent conclusions, imply false health, or use generic filler language.

## Implementation Standard

Before shipping UI work, check:

- Is the immediate state visually obvious?
- Is technical information available without being visually primary?
- Does the game workspace feel appropriate to the game?
- Are warnings meaningful instead of decorative?
- Does motion add life without distraction?
- Does the language match how a server owner talks?
- Are empty states honest?
- Does the screen avoid fake analytics?

The design system should make GameOps Bridge feel more like operating living worlds than inspecting backend telemetry.
