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

Players tab application rule: the tab must use master/detail. The player list browses compact player objects; the selected player detail inspects profile, telemetry, sessions, aliases, guild/save evidence, and raw IDs only behind disclosure. Guilds use the same pattern: one scrollable guild list browses, and the selected guild detail inspects lifecycle, activity, confidence, and member evidence. Avoid rendering every player or guild detail inline; repeated player sets belong in quiet diagnostics only.

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

## GPS 2.0: Operator Decision System

GPS 2.0 changes the product question from "What information do we have?" to "What should the operator do next?" Information is still necessary, but it is no longer the first-class shape of a screen. Every screen starts with a decision, then exposes the object that decision applies to, then gives evidence only as needed.

The required hierarchy for every major surface is:

1. Decision: the operator answer or state.
2. Objects: the thing the operator should inspect, select, or compare.
3. Evidence: the telemetry, source, diagnostic, or raw record that supports the decision.

If a feature cannot be placed in one of those layers, it is probably too early, too broad, or duplicating another surface.

### GPS 2.0 Product Rules

1. One screen answers one operator decision.
2. The first visible region should be an answer, not a collection of facts.
3. The primary object is selected once and inspected once.
4. Repeated objects collapse into list-to-detail flows.
5. Evidence supports decisions; it does not compete with them.
6. Diagnostics are third-layer material unless they create active attention.
7. Review paths navigate to existing surfaces only.
8. New features must use an approved panel type before inventing a new presentation style.
9. Screens have information budgets; overflow moves into disclosure, drawer, modal, or inspector.
10. Missing data must explain operator impact, not implementation failure alone.

## GPS 2.0 Global Decision Audit

| Screen | Primary decision | Primary object | Secondary object | Next action | Lowest priority information |
| --- | --- | --- | --- | --- | --- |
| Overview | Is everything okay across the operation? | Fleet | Servers needing attention | Open the server or Operations item with the highest attention signal. | Per-server connector metadata, raw event counts, implementation source labels. |
| Servers | Which server needs attention? | Server | Game grouping and fleet navigation | Select a server, then open its decision tab. | Fleet-wide totals once a server is selected. |
| Server Overview | Does this server need attention? | Selected server | Players, configuration, backups, history, capabilities | Follow the recommended review path. | Raw connector details, full activity logs, raw telemetry values. |
| Players | Which player deserves investigation? | Selected player | Guild, character, identity profile | Select a player, inspect detail, then review sessions or identity evidence. | Raw IDs, aliases, save filenames, low-confidence diagnostics. |
| Guilds | Which guild deserves investigation? | Selected guild | Members and activity signals | Select a guild, inspect activity/risk detail, then mark review when appropriate. | Full member dumps, missing activity internals, raw confidence inputs. |
| Settings / Configuration | Can I safely modify this server? | Configuration state | Candidate settings and event-template drafts | Review safety state, inspect readable settings, or stop if blocked. | Raw keys, paths, runtime audit internals, write-path diagnostics. |
| Backups | Am I protected? | Backup readiness | Latest backup and backup history | Review latest recovery state, then related history/settings/capabilities. | Proposed paths, file lists, validation notes, rollback diagnostics. |
| History | What changed? | Timeline event | Related players, settings, backups, capabilities | Open the most meaningful event or route to the related object. | Raw session timelines, activity log internals, source timestamps. |
| Capabilities | What can GameOps currently perform? | Capability area | Connector/freshness evidence | Open the object whose coverage is missing or risky. | Heartbeat details, modes, raw capability arrays, diagnostic panels. |
| Operations | What work is happening right now? | Current work item | Owning server | Open the owning server tab for the highest-priority work item. | Long-term reference information and quiet healthy objects. |
| Automation | What will happen automatically? | Planned automation capability | Schedules and rules when real data exists | Keep planned until real loaded automation exists. | Placeholder controls and speculative automation configuration. |
| Administration | What can I configure or maintain? | Maintenance reference | Server settings, backups, capabilities | Open Settings or Capabilities for the selected server. | Deep diagnostics, raw connector fields, unrelated player/history data. |

## GPS 2.0 Three-Layer Model

Layer 1 is Decision. It contains states such as Healthy, Needs Attention, Offline, Review Required, Read-only, Blocked, Unknown, or Evidence Available. Existing components that belong here include `ServerAttentionSummary`, `SafetySummaryCard`, `EvidenceSummaryCard`, top-level Operations work summaries, and the GPS 2.0 server overview decision spine.

Layer 2 is Objects. It contains selectable or comparable objects such as Servers, Players, Guilds, Configuration, Events, Backups, Capability Areas, and Current Work. Existing components that belong here include grouped server navigation, world cards, `PlayerObjectList`, guild master/detail lists, backup latest/history lists, review-next action lists, and world history timeline rows.

Layer 3 is Evidence. It contains telemetry, sources, aliases, raw IDs, connector status, freshness, confidence, diagnostics, and implementation proof. Existing components that belong here include `DataFreshnessBanner`, `OperatorDebugPanel`, observed settings drawers, activity/session log panels, runtime/config audits, identity diagnostics, source labels, and raw capability details.

The layer rule is strict: a lower layer may support a higher layer, but it should not visually outrank it.

## GPS 2.0 Duplication Audit

Repeated objects should become one list plus one selected detail wherever possible.

| Object | Current repetition pattern | GPS 2.0 direction |
| --- | --- | --- |
| Player | Player list, activity cards, telemetry rows, directory, profile, history, evidence, identity review, guild membership. | Use `Player List -> Selected Player`. Activity and identity evidence attach to the selected player or move to diagnostics. |
| Guild | Guild risk, guild intelligence, activity filters, member evidence, base/lifecycle context. | Use `Guild List -> Selected Guild`. Risk state is list metadata; activity, members, and confidence are selected-guild detail. |
| Event | Activity log, recent highlights, world history, chronicle, timeline, raw sessions. | Use `Timeline -> Selected Event`. Activity/session logs become evidence or diagnostics, not parallel histories. |
| Backup | Backup health, latest backup, backup history, readiness details, diagnostics. | Keep the Backups sequence, but only one latest backup object and one history list should be primary. File/path detail stays evidence. |
| Configuration | Settings safety, active controls, observed settings, audits, event template drafts, runtime/write-path evidence. | Use `Configuration Summary -> Candidate/Setting Detail`. Raw settings and paths belong in drawers or diagnostics. |
| Capability | Capability summary, operator workspace, Palworld coverage panels, connector status, data freshness. | Use `Capability Area List -> Selected Area Evidence`. Connector/freshness detail supports the selected capability. |
| Server | Fleet cards, grouped navigation, selected-server header, overview summary, operations/history/admin rows. | Cross-operation surfaces should route to a selected server rather than duplicating full server detail. |

## GPS 2.0 Panel Types

Future features should use these panel types:

| Panel type | Purpose | Typical layer |
| --- | --- | --- |
| Decision Panel | State, answer, recommended next action. | Decision |
| Summary Panel | Compact object health or state summary. | Decision or Objects |
| Object List | Browse and select stable objects. | Objects |
| Detail Panel | Inspect the selected object. | Objects |
| Timeline | Show meaningful ordered events. | Objects |
| Table | Compare many similar facts when scanning matters. | Objects or Evidence |
| Inspector | Show structured evidence for one selected object. | Evidence |
| Diagnostics | Show raw or troubleshooting information. | Evidence |
| Disclosure | Hide lower-priority supporting material inline. | Evidence |
| Drawer | Inspect rich detail without changing the primary workspace. | Objects or Evidence |
| Modal | Confirm or perform a real action only when capability exists. | Decision or Action |

Do not create new visual families for cards, rows, chips, forms, or panels unless an existing type cannot express the operator decision.

## GPS 2.0 Information Budgets

These budgets are defaults. A screen may be smaller, but exceeding the budget requires moving content into disclosure, drawer, modal, or inspector.

| Screen | Recommended maximum visible budget |
| --- | --- |
| Overview | 3 summary panels, 1 server object list, 1 current-work list, 1 compact history list. |
| Servers / Server Overview | 1 decision panel, 1 object list/review path, 1 evidence strip, 1 timeline or activity panel. |
| Players | 1 player list, 1 selected-player detail, 1 timeline/session panel, 1 diagnostics disclosure. |
| Guilds | 1 guild list, 1 selected-guild detail, 1 member/activity panel, 1 diagnostics disclosure. |
| Settings / Configuration | 1 safety summary, 1 candidate/settings object list, 1 detail panel, 1 diagnostics disclosure/drawer. |
| Backups | 1 backup health summary, 1 latest backup panel, 1 backup history list, 1 diagnostics disclosure. |
| History | 1 timeline summary, 1 timeline, 1 selected-event drawer/detail, 1 raw diagnostics disclosure. |
| Capabilities | 1 coverage summary, 1 capability area list, 1 selected-area evidence panel, 1 diagnostics disclosure. |
| Operations | 1 current-work list, 1 selected work detail, 1 route/action list. |
| Administration | 1 reference summary, 1 server/reference list, 1 selected reference detail. |

Everything else should be hidden until the operator asks for it.

## GPS 2.0 Proof Of Concept

The initial local POC is the Server Overview decision spine. It places the selected server into the GPS 2.0 hierarchy:

1. Decision: what the operator should do next.
2. Objects: which object explains or resolves that decision.
3. Evidence: the minimal proof behind the recommendation.

The POC is intentionally small and reversible. It adds no backend capability, connector behavior, persistence, route migration, automation, Palworld behavior, Valheim behavior, deployment change, write action, restore action, restart action, or new data source.

## GPS 2.1 Workflow Navigation Study

GPS 2.1 asks whether the selected-server console should remain organized by object tabs or eventually move toward operator workflow navigation. This is a study, not a migration plan. Current routes and tabs remain stable until a future release proves that workflow navigation improves operator speed without hiding important objects.

### Operator Workflow Audit

| Job | Operator goal | Objects involved | Existing tabs involved | Frequency | Decision being made |
| --- | --- | --- | --- | --- | --- |
| Monitor | Understand whether the selected server needs attention now. | Server, current players, warnings, latest activity, freshness. | Overview, Capabilities, History. | Every visit. | Should I keep watching, investigate, or act elsewhere? |
| Investigate | Find who or what explains a signal. | Players, guilds, events, sessions, world memories, warnings. | Players, History, Overview. | Frequent when activity or alerts exist. | Which player, guild, or event deserves inspection? |
| Configure | Decide whether settings can be safely reviewed or changed later. | Configuration, setting candidates, templates, runtime evidence. | Settings, Capabilities, Backups. | Occasional. | Can I safely modify this server, or is the path blocked? |
| Recover | Understand recovery confidence before relying on backups. | Backup readiness, latest backup, files, runtime config, history. | Backups, Settings, History, Capabilities. | Rare but high stakes. | Am I protected, and what evidence supports recovery? |
| Maintain | Check coverage, connector health, data freshness, and platform limits. | Capabilities, connector, telemetry, settings coverage, diagnostics. | Capabilities, Overview, Administration. | Periodic and after setup changes. | What can GameOps currently observe or support? |
| Review Change | Understand what changed recently and whether follow-up is needed. | Events, timeline records, players, configuration, backups. | History, Players, Settings, Backups. | Frequent during active worlds. | What changed, and which object should I inspect next? |

The jobs are workflow-oriented, but the objects are still essential. A workflow without clear object selection would make investigation slower because operators still need to land on a player, guild, event, backup, or configuration detail.

### Current Server Tab Navigation Audit

| Current tab | Workflow? | Object? | Implementation? | GPS 2.1 read |
| --- | --- | --- | --- | --- |
| Overview | Yes: Monitor. | Yes: selected server. | No. | Keep as the default server decision surface. It should keep answering "Does this server need attention?" |
| Players | Partly: Investigate people/activity. | Yes: players, characters, guilds. | No. | Keep as an object tab, but frame it as investigation. Future workflow navigation could route Investigate to this object area. |
| Settings | Yes: Configure. | Yes: configuration. | Slightly: "settings" is an implementation-flavored label compared with "Configuration." | Long term, rename or group under Configure/Configuration when route migration is planned. Do not change route now. |
| Backups | Yes: Recover. | Yes: backup/recovery evidence. | No. | Keep as an object tab with a clear Recover workflow role. |
| History | Yes: Investigate/Review Change. | Yes: events and timeline. | No. | Keep as evidence-heavy object navigation. Future workflow navigation may combine History with Investigate entry points. |
| Capabilities | Partly: Maintain. | Yes: capability areas and connector coverage. | Somewhat: capability coverage is partly product/platform evidence. | Keep as a lower-frequency Maintain surface; avoid making it a daily operating tab unless it produces active attention. |

The current tabs are mostly object navigation with workflow intent embedded in each screen. They are not purely implementation tabs, but Settings and Capabilities are closest to implementation language.

### Model Comparison

Current object navigation:

| Advantage | Disadvantage | Migration risk |
| --- | --- | --- |
| Stable, predictable, and already maps to GameOps objects. | Operators must infer the job from object labels. | Low if kept; users already understand the model. |
| Makes selected-object detail easy to locate. | Investigation crosses Players, History, Capabilities, and sometimes Settings. | Low. |
| Supports game-specific objects without changing permanent workflows. | Settings and Capabilities can feel like feature buckets. | Low. |
| Fits GPS 2.0 object/detail/evidence hierarchy. | Repeated review paths are needed to guide operators between tabs. | Low. |

Workflow navigation:

| Advantage | Disadvantage | Migration risk |
| --- | --- | --- |
| Matches operator intent: Monitor, Investigate, Configure, Recover, Maintain. | Can hide concrete objects behind abstract verbs. | Medium to high because routes, deep links, tests, and operator muscle memory would change. |
| Reduces "which tab do I need?" uncertainty for common jobs. | Some workflows share the same objects, especially Investigate and Review Change. | Medium. |
| Makes future AI/operator guidance easier to explain. | Could duplicate existing object views unless carefully composed. | High if implemented before object duplication is reduced. |
| Better fit for decision-first product language. | Capability and diagnostics evidence may be harder to place cleanly. | Medium. |

### Recommendation

Do not replace the current server tabs yet. The long-term direction should be workflow-aware object navigation:

1. Keep the existing object tabs as stable destinations.
2. Continue adding workflow language inside the tabs and review paths.
3. Reduce object duplication first, especially Players/Guilds/Events.
4. Later, test a workflow shell where Monitor, Investigate, Configure, Recover, and Maintain are entry points that route to the same underlying object surfaces.
5. Migrate routes only when workflow entry points can preserve deep links, keyboard behavior, tests, and operator muscle memory.

The recommended future model is not pure workflow navigation and not pure object navigation. It is workflow entry, object workspace, evidence detail.

### GPS 2.1 Small POC

The GPS 2.1 POC adds quiet workflow labels to the existing server tab buttons:

- Overview -> Monitor
- Players -> Investigate
- Settings -> Configure
- Backups -> Recover
- History -> Investigate
- Capabilities -> Maintain

This is intentionally reversible. It changes no routes, no tab keys, no backend behavior, no connector behavior, no persistence, no operational controls, and no navigation state. Its purpose is only to test whether workflow language helps the existing object tabs read as operator jobs.
