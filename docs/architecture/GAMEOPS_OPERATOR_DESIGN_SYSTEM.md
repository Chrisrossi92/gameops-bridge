# GameOps Operator Design System

GameOps should feel like a calm operations console for game worlds. It should lead with the object an operator cares about, show the next useful decision, and keep technical evidence available without making it the first read.

## Product Language

1. One screen answers one primary question.
2. One screen has one primary object.
3. Summaries come first, evidence second, and raw diagnostics third.
4. Cards summarize.
5. Lists browse.
6. Tables compare.
7. Drawers inspect.
8. Modals act.
9. Paragraphs are rare.
10. Progressive disclosure is the default.
11. Status chips are short labels, not explanations.
12. Raw config keys and backend labels stay hidden unless the operator drills into details.
13. Fleet metadata and server metadata remain separate.
14. Every screen has an obvious next action or an obvious reason no action is available.
15. Visual consistency is more important than adding new UI patterns.

## Product Inventory

GameOps objects should be stable across games. A new game can add object-specific evidence, but it should not force the operator to relearn the shell.

| Object | Purpose | Operator question | Decision | Usual next action |
| --- | --- | --- | --- | --- |
| Fleet | The full configured set of worlds. | Is everything okay across my operation? | Which server needs attention first? | Open a server or Operations. |
| Server | One selected game world. | Does this server need attention? | Should I investigate, wait, or act elsewhere? | Open Players, Configuration, Backups, History, or Capabilities. |
| Player | A person, account, or character identity. | Who is this and what are they doing? | Review activity, identity confidence, or relationships. | Open player drawer, inspect sessions, review identity evidence. |
| Configuration | Readable server settings and safety limits. | What happens if configuration changes? | Is read access trusted, and are edits blocked? | Review candidates, read evidence, or safety notes. |
| Backup | Recovery evidence for a server. | Can I safely recover? | Is a restore plan trustworthy? | Review latest backup, recovery readiness, or backup history. |
| History | Trusted events and activity records. | What happened? | Which event needs evidence or follow-up? | Open event drawer or server history detail. |
| Event | A single meaningful change or observation. | What exactly happened here? | Is this event trustworthy and connected to other objects? | Inspect evidence, related players, or related server history. |
| Capabilities | What GameOps can observe, infer, or support. | What can this console know or do? | Which data or controls are available, missing, or blocked? | Review settings evidence, diagnostics, or related object tabs. |
| Operations | Current cross-server work and attention. | What work is happening right now? | Which active issue needs follow-up? | Route into the owning server tab. |
| Automation | Future scheduled or automatic behavior. | What will happen automatically? | Is planned automation real, safe, and reviewable? | Review schedules/rules only when real loaded data exists. |
| Administration | Low-urgency configuration and maintenance reference. | What can I configure or maintain? | Which server or connector reference needs inspection? | Open server Settings or Capabilities. |

## Object Templates

Templates define order and hierarchy. They do not require every slot to render on every screen, but missing slots should be intentional.

### Fleet

- Hero: fleet name, total health, current attention.
- Health Summary: online/offline, warnings, current players, freshness.
- Important Objects: servers needing attention.
- Quick Actions: open server, open Operations, open History.
- Recent Activity: newest cross-server change.
- Details: fleet metadata and loaded-source evidence.

### Server

- Hero: game, server name, state, quiet server metadata.
- Health Summary: attention, warnings, current activity, recommended action.
- Quick Actions: open relevant server tabs.
- Important Objects: current players, configuration, backups, recent events.
- Recent Activity: latest meaningful world or operational events.
- Details: connector, telemetry, and diagnostics.

Server Overview application plan:

1. Preserve the selected-server hero as the object anchor.
2. Keep Server Attention Summary as the Health Summary.
3. Add a compact Review Next / Quick Actions row after health, using existing tabs only.
4. Group Important Objects below quick actions: players, configuration, backups, and high-signal events.
5. Put Recent Activity after Important Objects so the operator sees state before chronology.
6. Keep connector, telemetry, raw freshness, and diagnostics in Details or Capabilities unless they create active attention.
7. Do not add controls, write actions, restarts, recovery actions, automation, or route changes during the template pass.

GPS 1.0C implementation note: Server Overview now uses the selected-server hero, Server Attention Summary, compact Review Next actions, Important Objects, then lower-priority recent activity/details. Review Next must route only to existing server tabs until real operational actions exist.

### Player

- Hero: display name, current presence, identity state.
- Current Status: online/session/level/guild or game-specific activity.
- Session: current and recent activity.
- Timeline: meaningful player history.
- Relationships: guilds, characters, save identity, events.
- Details: raw identity, telemetry, and confidence evidence.

Players tab application rule: the tab should start with player activity summary, then a compact Review Next player list/table, then directory/context/evidence. Player rows should expose name, online/offline state, recent activity, and one useful inspection hint before lower-priority details.

### Configuration

- Hero: selected server configuration state.
- Configuration Health: read state, edit state, blocker, review-next target.
- Safe Actions: read-only reviews, candidate inspection, safety notes.
- Evidence: readable settings, source, runtime match, rollback notes.
- Diagnostics: raw keys, paths, connector mode, audit warnings.

### Backup

- Hero: selected server recovery state.
- Latest Backup: newest known backup and freshness.
- Recovery Actions: read-only readiness and future recovery path.
- Backup History: previous backup evidence.
- Details: paths, verification gaps, raw backup metadata.

### History

- Hero: selected scope and timeline question.
- Timeline: meaningful events first.
- Filters: compact view controls.
- Details: event drawer, source evidence, related objects.

### Capabilities

- Hero: selected server coverage state.
- Coverage Summary: what GameOps can observe or support now.
- Review Next: navigation to the most useful supporting object.
- Capability Areas: settings, players, telemetry, backups, activity confidence.
- Diagnostics: connector status, freshness, raw capability evidence.

### Operations

- Hero: current work across the operation.
- Current Work: active warnings, stale data, offline/degraded servers.
- Action List: route to the owning server object.
- Details: evidence and timestamps.

### Administration

- Hero: read-only maintenance/reference scope.
- Reference Summary: configured servers, readable settings, write availability.
- Object Links: server Settings and Capabilities.
- Details: connector or platform reference.

## Product Shell

The shell stays stable while the object inside it changes.

### Permanent Top Navigation

Current top-level areas:

- Overview: fleet answer to "Is everything okay?"
- Servers: server selection and selected-server workspace.
- Operations: active work.
- Automation: planned until real loaded automation data exists.
- History: cross-operation records.
- Administration: read-only maintenance reference.

Future permanent shell candidates:

- Search: global object lookup across servers, players, events, and history.
- Notifications: current attention and unresolved review items.
- Operator: account, preferences, and operator-scoped settings.

### Object Navigation

Object navigation changes with the selected object.

Server context currently uses:

- Overview
- Players
- Settings
- Backups
- History
- Capabilities

Future server context may rename Settings to Configuration and expose Events when trusted event volume justifies a separate tab. The product rule is stable: object tabs answer object-specific questions, not implementation-source questions.

### Permanent Versus Contextual

- Permanent navigation answers operation-wide questions.
- Contextual navigation answers questions about the selected object.
- Fleet metadata belongs in the fleet shell.
- Server metadata belongs in the selected-server context.
- Player, event, and guild detail belongs in drawers unless the object becomes a full workspace.

## Object Relationships

The product mental model should scale naturally as games are added.

```text
Fleet
`-- Server
    |-- Players
    |   |-- Player
    |   |-- Character
    |   |-- Guild
    |   `-- Base
    |-- Configuration
    |   |-- Setting
    |   |-- Candidate Change
    |   `-- Safety Evidence
    |-- Events
    |   |-- World Event
    |   |-- Operation Event
    |   `-- Player Event
    |-- Backups
    |   |-- Latest Backup
    |   `-- Recovery Evidence
    |-- History
    |   |-- Timeline
    |   `-- Event Detail
    `-- Capabilities
        |-- Coverage Area
        |-- Connector Evidence
        `-- Diagnostics
```

Rules:

- A child object can summarize in its parent, but its evidence belongs in the child workspace or drawer.
- Cross-server surfaces may route to server objects, but they should not duplicate full server tabs.
- Game-specific objects should map into the same relationship model before adding new navigation.
- If an object has no real data yet, show a planned or empty state instead of inventing controls.

## Hierarchy

### Level 1: Operator Answer

The first visible block answers the screen question in plain language. It should show current state, attention, and the next action. It should not show raw paths, connector internals, or every supporting fact.

### Level 2: Operating Context

The second layer explains what changed, who is involved, and what choices exist. Use compact rows, lists, or summaries.

### Level 3: Evidence

Evidence proves why GameOps believes the answer. It can include sources, timestamps, matched counts, stale states, safety notes, and capability limits.

### Level 4: Raw Diagnostics

Raw diagnostics are for inspection and troubleshooting only. They belong in disclosures, drawers, diagnostic panels, or the Capabilities tab.

## Reusable Patterns

### Page Hero

Use for a top-level area or selected server. It identifies the primary object, the state, and the next operator question. Keep metadata quiet and scoped.

### Object Summary Card

Use one card to summarize one meaningful object, such as selected server health, configuration health, recovery readiness, or player activity. Avoid one card per tiny fact.

### Status Row

Use compact rows for comparable facts: source, count, freshness, confidence, editing state, last verified time. Rows should use short labels and short values.

### Action List

Use when the operator needs to choose the next investigation path. Actions can route to existing tabs, open details, or explain why no action exists. Do not add operational capability through presentation.

### Detail Disclosure

Use `details` sections for supporting facts that should be available but not visually primary. Good for capability limits, config paths, matched values, safety notes, validation steps, and raw setting samples.

### Metadata Strip

Use for quiet scoped metadata. Fleet strips contain fleet facts only. Server strips contain selected-server facts only. Do not mix them.

### Empty State

An empty state should say what is missing and what that means for the operator. It should not fill space with unrelated diagnostics.

### Safety/Warning Block

Use warnings for blocked, stale, risky, or unverified states. Keep the copy specific and action-oriented. Avoid repeating the same badge across several cards.

### Raw Diagnostics Area

Use for backend evidence, raw setting names, connector details, and debug values. It should be lower on the page, quiet, and clearly separate from the operator answer.

## Current Anti-Patterns To Remove

- One card per tiny fact.
- Paragraphs inside summary cards.
- Repeated READY/BLOCKED badges.
- Long raw setting names in primary views.
- Backend implementation terms as primary navigation.
- Equal visual weight for everything.
- Metadata strips that mix fleet state with selected-server state.
- Configuration paths or raw keys shown before the operator asks for evidence.
- Capability matrices placed in daily operating views when nothing needs attention.

## Application Rules

- Overview answers whether everything is okay.
- Servers is where the selected server becomes the primary object.
- Server Overview answers whether that server needs attention.
- Settings answers what happens if configuration changes.
- Backups answers recovery confidence through Backup Health, Review Next, Latest Backup, Backup History, Backup Details, then Diagnostics.
- Backups must make missing backup records explicit instead of implying a restore point exists; restore/write controls require separate capability work.
- Capabilities answers what the console can observe, infer, or support.
- History answers what happened through summary, Review Next, event timeline, event detail, then raw diagnostics.
- History rows should expose event type, time, short description, and status first; evidence labels, discovery time, and diagnostic context belong behind row details or lower evidence panels.
- Evidence can be complete without being expanded by default.
- Read-only previews must not look like live controls.
- Future write, restart, deploy, automation, or connector behavior must be introduced through explicit capability work, not UI rewording.

## GPS 1.0I Consistency Note

The GPS 1.0I audit covered the selected-server shell, grouped server navigation, Overview, Players, Settings, Backups, History, Capabilities, shared row/card styling, empty states, diagnostics placement, and responsive stacking.

Rules reinforced:

- `Review Next` is reserved for existing navigation or existing inspection paths; it must not imply write, restore, restart, deploy, or automation capability.
- Each server tab should preserve the same object flow: summary first, review path next when useful, object list/timeline/history in the middle, details and diagnostics last.
- Lists and timelines should carry object scanning. Paragraphs should explain only missing data, safety boundaries, or empty states.
- Diagnostics remain quiet, lower priority, and separate from the operator answer.
- Empty states should state what data is missing and what that means, without inventing activity or controls.

Intentionally out of scope before deploy: backend/API changes, connector changes, Palworld or Valheim behavior changes, persistence changes, route migration, live backup/restore/write controls, automation, and deployment.
