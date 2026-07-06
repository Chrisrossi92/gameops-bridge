# GameOps Operator Experience

Phase 11A defines GameOps Bridge as a calm Operations Console for game worlds. This is an information architecture and experience direction, not a backend capability plan.

The product should help an operator answer four questions quickly:

- Is everything okay?
- What needs attention?
- What changed?
- What should I do next?

## Product Framing

GameOps is moving from a dashboard into an Operations Console.

A dashboard collects status. An Operations Console organizes status into decisions. GameOps should still show telemetry, server health, connector confidence, settings evidence, world history, players, backups, and automation state, but those details should be arranged by operator intent instead of stacked by implementation order.

The primary experience should feel like entering a professional control surface for living game worlds:

- quiet when healthy
- clear when attention is needed
- evidence-backed when trust matters
- game-aware without becoming decorative
- dense only after the operator asks for detail

## Operator Personas

### Server Owner

Owns one or a few community servers. Opens GameOps to confirm that worlds are alive, players are active, and no immediate action is required.

Needs:

- a fast health read
- recent activity
- warnings in plain language
- confidence before changing settings or recovering backups

### Community Operator

Watches player behavior, guilds, bases, sessions, and world events. Uses GameOps to understand what players are doing and what changed since the last visit.

Needs:

- current players
- player and guild detail
- world history
- identity confidence
- activity patterns without fake analytics

### Technical Maintainer

Keeps collectors, connectors, deployments, data freshness, and diagnostics trustworthy. Uses GameOps when something is stale, degraded, or difficult to explain.

Needs:

- pipeline and connector health
- raw evidence
- configuration metadata
- logs and diagnostics
- clear separation between operator-facing state and implementation detail

### Future Automation Supervisor

Reviews automations, schedules, generated recommendations, and proposed changes. This persona should not require new write capabilities in this phase, but the IA should prepare for safe review and audit flows.

Needs:

- what automation observed
- what it recommends
- what it would change
- why it is safe or blocked
- full history after any action exists

## Design Principles

### One Primary Question Per Screen

Every major screen should answer one question:

- Overview: Is everything okay?
- Servers: Which server needs attention?
- Server Overview: Does this server need my attention?
- Players: Who is here, what are they doing, and who needs attention?
- Player detail: What is this player doing?
- Settings: What happens if I change this?
- Backups: Can I safely recover?
- Operations: What work is happening right now?
- Automation: What will happen automatically?
- History: What happened across the operation?
- Administration: What can I configure or maintain?

If a screen is answering several unrelated questions, split it into tabs, panels, drawers, or a different top-level area.

### Calm By Default

Healthy systems should not look empty, anxious, or over-instrumented. A healthy state should have a confident summary, current activity, and a quiet path to deeper evidence.

Warnings should be specific and actionable. Errors should be reserved for broken, unavailable, stale, or untrustworthy states.

### Operational Summary Before Evidence

Lead with the conclusion the operator can act on, then show why it is trustworthy.

Good order:

1. Current health
2. Recommended action
3. Warnings and current activity
4. Recent operations and players
5. Evidence, telemetry, diagnostics, and raw detail

### Worlds Before Technology

Operators think in worlds, players, guilds, settings, backups, and events. Collectors, pipelines, REST, RCON, identity resolution, and raw telemetry support trust, but they should not visually compete with world state.

### Progressive Disclosure

Use this depth model consistently:

```text
Overview -> tabs -> expandable panels -> drawers -> dialogs
```

Overview pages summarize. Tabs separate jobs. Expandable panels hold secondary detail. Drawers preserve investigation context. Dialogs are reserved for focused confirmations, previews, or future write actions.

## Top-Level Navigation Proposal

### Overview

Primary question: Is everything okay?

Scope:

- all configured servers
- current health
- active warnings
- current activity
- recommended next action

Avoid:

- raw telemetry
- full settings tables
- debug details
- per-game deep investigation

### Servers

Primary question: Which world needs attention?

Scope:

- server list
- server cards or table
- game, status, players online, latest activity, warning count
- entry point into each server workspace

Servers should be the stable home for selecting a world. Overview can show a condensed version, but Servers is where comparison and selection belong.

### Operations

Primary question: What work is happening right now?

Scope:

- operational warnings
- connector freshness
- backup readiness summaries
- deployment or local environment warnings
- data freshness and pipeline health
- recommended actions

Operations should combine cross-server operational concerns without becoming the default place for community or player state.

### Automation

Primary question: What will happen automatically?

Scope:

- automation inventory
- read-only schedule state
- proposed actions and reasons
- blocked automations
- future approval/review flows

This phase does not add automation behavior. The IA simply reserves the space so future automation does not get scattered across unrelated cards.

### History

Primary question: What happened?

Scope:

- cross-server operator timeline
- deployments and operational changes
- warnings created or resolved
- important world events with server filters
- audit records when future write actions exist

History should prioritize readable event grouping and evidence access over raw log browsing.

### Administration

Primary question: What can I configure or maintain?

Scope:

- configured servers
- connectors and capabilities
- environment and deployment metadata
- identity and access configuration when it exists
- technical diagnostics entry points

Administration is not the daily operating surface. It is where setup, configuration, and platform-level maintenance live.

## Final Top-Level Navigation Contract

Phase 11K extends the server IA contract into the full GameOps shell. The top-level navigation should route operators by job, not by implementation source.

The proposed top-level areas are:

- Overview
- Servers
- Operations
- Automation
- History
- Administration

Each area owns one primary question. If a new surface answers a different question, it belongs somewhere else or should be summarized once and disclosed deeper.

### Overview

Primary question: Is everything okay?

Belongs here:

- global health summary
- highest-priority warnings
- current attention
- recommended next operator action
- current activity summary
- small cross-server metric strip
- entry points into Servers, Operations, and History when attention exists

Does not belong here:

- full selected server console
- raw telemetry
- complete settings/configuration panels
- backup evidence details
- automation rule editors
- connector diagnostics unless they directly affect current attention
- every operator card at equal visual weight

Overview is the daily first read. It should stay calm when nothing needs action and direct the operator to the right deeper surface when something does.

### Servers

Primary question: Which server needs attention?

Belongs here:

- server list or server table
- server cards with game, status, current players, last activity, and warning count
- server-specific entry points
- selected server console
- finalized per-server tabs: Overview, Players, Settings, Backups, History, Capabilities

Does not belong here:

- global operations queue duplicated in full
- automation inventory
- cross-server platform diagnostics
- broad operator intelligence cards unrelated to the selected server

Servers is the home for world comparison and server-specific work. A top-level Overview may summarize servers, but the selected server console lives here.

### Operations

Primary question: What work is happening right now?

Belongs here:

- active operator workflows
- current operational attention
- live or recent work queues
- pending operational items
- current player/server activity when it affects operations
- connector freshness or data freshness when it is creating active work
- recommended operational follow-up

Does not belong here:

- long-term configuration reference
- raw historical search
- automation rule authoring
- per-server deep player investigations unless they are part of an active work item
- low-priority capability matrices

Operations is for now. It should prioritize what is underway, what is blocked, and what the operator should handle next.

### Automation

Primary question: What will happen automatically?

Belongs here:

- automation rules
- schedules
- templates
- upcoming automated actions
- proposed actions awaiting review
- blocked or disabled automation state
- automation history or health only when needed to explain future behavior

Does not belong here:

- manual operator workflows without automation
- raw telemetry unrelated to scheduled behavior
- general historical timelines
- server settings controls unless they are part of an automation template or preview
- invented write controls

Automation should explain what will happen without manual action. This architecture reserves the surface without adding automation behavior.

### History

Primary question: What happened across the operation?

Belongs here:

- cross-server operator timeline
- global activity log
- incident/event review
- deployment or operational changes
- warnings created or resolved
- cross-server world-memory and chronicle search entry points
- audit records when future write actions exist

Does not belong here:

- per-server History tab replacement
- current activity as the primary surface
- automation authoring
- settings and backup controls
- raw logs before trusted timeline summaries

Top-level History shows the operation-wide record. Per-server History remains the focused answer for what happened on one server.

### Administration

Primary question: What can I configure or maintain?

Belongs here:

- configuration
- diagnostics
- capabilities
- connected systems
- maintenance/reference tools
- environment and deployment metadata
- connector setup and status reference
- platform-level technical details

Does not belong here:

- daily health summaries
- live player activity
- active operations queues
- automation schedules as a primary surface
- user-facing history timelines except as diagnostic evidence

Administration is lower-priority than Overview and Operations. It should stay quiet, technical, and reference-oriented.

## Top-Level Surface Inventory

Existing surfaces should be routed as follows. If a surface appears in more than one place, the highest-level location should summarize it and the deeper location should carry the detail.

| Existing surface | Primary top-level area | Deeper location | Notes |
| --- | --- | --- | --- |
| Fleet health / current status | Overview | Servers | Overview summarizes; Servers compares and opens each server. |
| Server list / world cards | Servers | Server Overview | The list is the entry point into the selected server console. |
| Selected server console | Servers | Per-server tabs | Keep the Phase 11J server tab contract intact. |
| Server Attention Summary | Servers | Server Overview | Also inform Overview in aggregate, but do not duplicate the full component globally. |
| Operator Workspace cards | Operations | Capabilities or Administration for debug detail | Split current attention and recommendations from memory/debug/reference cards. |
| Operator brief / daily brief | Overview or Operations | History for archive | Overview can show the short read; Operations carries active follow-up. |
| Operator insights / recommendations | Operations | History for resolved items | Recommendations should become active work or historical evidence, not generic cards. |
| Operator memory index | Administration | History when searched cross-server | Memory index is reference; search results can support History. |
| Operator timeline | History | Operations for current unresolved items | Timeline is the trusted record; unresolved items can surface in Operations. |
| World memory search | History | Per-server History | Cross-server search belongs top-level; scoped search belongs per-server History. |
| Chronicle / world history | History | Per-server History | Global timeline aggregates; server tab investigates one world. |
| Player intelligence | Servers | Per-server Players | Only aggregate player activity belongs in Overview or Operations. |
| Palworld guilds / bases | Servers | Per-server Players or Capabilities | Player/world context belongs Players; telemetry/reference belongs Capabilities. |
| Valheim characters / realm context | Servers | Per-server Players or History | Character context belongs Players; remembered events belong History. |
| Activity timelines / session timelines | History | Per-server Players or History | Live/current activity can summarize in Operations. |
| Settings/config panels | Administration | Per-server Settings | Safety-first setting impact belongs per-server; platform config belongs Administration. |
| Boost/event template drafts | Automation or Settings | Per-server Settings for manual preview | If scheduled or automatic, route to Automation; if read-only impact preview, route to Settings. |
| Backup/readiness panels | Operations or Administration | Per-server Backups | Active backup risk can surface in Operations; evidence stays Backups. |
| Capability/diagnostic panels | Administration | Per-server Capabilities | Keep quiet unless a diagnostic creates active attention. |
| Connector status / data freshness | Operations or Administration | Per-server Capabilities | Active stale/degraded state goes Operations; reference details go Administration/Capabilities. |
| Automation-related surfaces | Automation | History for completed automation | Future schedules and proposed automatic actions belong Automation. |
| Audit / write-action history | History | Per-server History where scoped | Future writes must leave a History trail. |

## Relationship Between Top-Level Navigation And Server Tabs

Top-level navigation answers operation-wide questions. Server tabs answer one selected server's questions.

- Overview can summarize server attention, but server-specific diagnosis starts in Servers.
- Servers owns the selected server console and must preserve the Phase 11J tab contract.
- Operations can point to a server tab when work is server-specific.
- Automation can point to server Settings, Backups, or Capabilities when a future automated action depends on those surfaces.
- History can aggregate events across servers, but detailed server evidence stays in per-server History.
- Administration can expose platform and connector reference, but per-server capability evidence stays in per-server Capabilities.

## Top-Level Future Feature Routing Rules

- Ask the primary question first. Route by what the operator is trying to decide.
- If the feature answers "Is everything okay?", summarize it in Overview.
- If the feature answers "Which server needs attention?", route it to Servers.
- If the feature answers "What work is happening right now?", route it to Operations.
- If the feature answers "What will happen automatically?", route it to Automation.
- If the feature answers "What happened across the operation?", route it to History.
- If the feature answers "What can I configure or maintain?", route it to Administration.
- If a feature spans multiple top-level areas, show one concise summary at the highest-priority area and keep details in the owning area.
- Do not create a new global card when a focused row, tab, drawer, or evidence panel would preserve the hierarchy.
- Do not force fake parity between games or between top-level areas. Use calm empty/reference states where data or capability does not exist.

## Phase 11L Navigation Shell POC

The initial top-level shell should communicate route intent without migrating major surfaces yet.

Current representation:

- Overview is the current landing surface and remains the daily first read.
- Servers is represented by the existing world cards and selected server console. Entering Valheim or Palworld marks the shell as Servers.
- Operations is now the first real workflow surface. Automation, History, and Administration remain planned route-intent areas only.

Intentionally deferred:

- full routing
- moving Operator Workspace cards into Operations
- moving cross-server chronicle/search into top-level History
- moving diagnostics and platform reference into Administration
- creating automation screens or controls
- changing per-server tab behavior

Future migration should move one surface at a time. The shell should remain stable while each area becomes real.

## Phase 11M Operations Workflow POC

Operations is the first planned top-level area to become a real workflow surface.

Initial rule:

- Operations answers "What work is happening right now?"
- Operations may mirror or summarize existing loaded activity, warning, stale-data, degraded-server, offline-server, and active-player signals.
- Operations should show current work only. It is not the cross-server historical record.
- Operations rows may route the operator into the existing server console for detail.
- The owning details remain in the relevant server tabs: Players, Settings, Backups, History, and Capabilities.

Intentionally deferred:

- migrating all Operator Workspace cards
- moving full activity timelines out of server tabs
- creating work queues, assignments, acknowledgements, or write actions
- turning History into an Operations feed
- moving technical diagnostics out of Administration or per-server Capabilities

Operations should remain smaller than Overview and narrower than the server console. If no current work is detected, the empty state should be honest rather than filling the area with raw logs or old history.

Phase 11N browser QA confirmed the shell pattern:

- live top-level areas are selectable and keep a clear selected state
- planned areas remain visible as route intent, are announced as planned, and must not navigate to unfinished screens
- Operations is reachable by keyboard, summarizes current work first, and routes detail back into the relevant server console
- mobile layouts may use internal top-nav scrolling, but must avoid page-level horizontal scrolling

## Phase 11O Top-Level History Read-Only POC

History is the second planned top-level area to become a real workflow surface.

Initial rule:

- History answers "What happened across the operation?"
- History summarizes cross-operation change from existing loaded activity, event, and data-trust records.
- History should prioritize what changed, when it changed, and which server owns the detail.
- History rows may route the operator into the existing server History tab for investigation.
- Server History remains the deep timeline, chronicle, search, and raw-evidence surface.

Intentionally deferred:

- migrating full per-server History content
- creating a global Chronicle or search page
- turning History into Operations with older timestamps
- adding new event sources, history APIs, or write actions
- moving technical diagnostics out of server Capabilities

Top-level History should remain smaller than the server console. If global history is thin, use an honest empty state rather than filling the page with current-work rows or raw diagnostics.

## Phase 11P Automation Intent Decision

Automation remains planned.

Decision:

- Current loaded data includes event-template drafts and readiness/reference surfaces, but those are manual dashboard drafts and safety previews.
- The current UI does not load real automation rules, scheduled executions, upcoming automated actions, or automation runtime state.
- Promoting Automation to a live top-level area now would imply supported automation that does not exist yet.

Condition to become live:

- Automation can become selectable only when existing loaded data can truthfully answer "What will happen automatically?"
- Acceptable sources include real schedules, enabled automation rules, queued/upcoming automatic actions, disabled automation state, or automation runtime health.
- Read-only summaries may route to server Settings, Backups, History, or Capabilities for supporting detail, but must not add controls or write actions.

Guardrails:

- Do not use Automation as fake parity for event-template drafts, diagnostics, or current work.
- Do not duplicate Operations rows or History records.
- Do not imply a schedule, rule, or automated action exists unless loaded data says it exists.
- If only manual draft or preview data is available, keep the content in Settings or Capabilities and keep Automation planned.

## Phase 11Q Administration Reference POC

Administration is live as a small read-only reference surface.

Decision:

- Current loaded data includes configured server inventory, settings capability summaries, readable settings coverage, write-path status, and maintenance/readiness evidence.
- This data can truthfully answer "What can I configure or maintain?" at a fleet level without adding controls.
- Detailed configuration, backup, and diagnostic evidence remains in per-server Settings, Backups, and Capabilities.

Initial rule:

- Administration summarizes top-level configuration and maintenance reference only.
- Administration rows may route operators into existing server Settings or Capabilities tabs for details.
- Administration should stay quiet, lower urgency than Overview and Operations, and read-only until explicit admin workflows exist.
- Write-path visibility is reference information, not an invitation to change server state.

Guardrails:

- Do not migrate every server Settings, Backups, or Capabilities panel into Administration.
- Do not add maintenance actions, configuration editors, connector controls, or new admin APIs.
- Do not use Administration as a dumping ground for raw telemetry or unrelated diagnostics.
- If a future admin feature answers a server-specific question, summarize it here once and disclose details in the correct server tab.

## Phase 11R Top-Level Shell QA Rules

Browser QA confirmed the top-level shell contract after Overview, Servers, Operations, History, and Administration became live.

Rules:

- Live top-level areas must present one primary question and one focused surface.
- Automation remains the only planned area until real loaded automation data exists.
- Planned top-level areas must use disabled semantics and intent copy rather than empty fake pages.
- Top-level route cues may open existing server tabs, but must preserve the intended destination tab through server-change resets.
- Mobile may use internal horizontal scrolling for the top-level nav, but the page itself must not horizontally overflow.
- Operations, History, and Administration must remain visually distinct: current work, cross-operation change, and read-only configuration/reference.

## Per-Server Navigation Proposal

Each server workspace should use focused views instead of stacking every section on one long page.

### Overview

Primary question: Does this server need my attention?

Content:

- server artwork or game-aware status hero
- current state
- recommended action
- warnings
- online players
- latest meaningful activity
- recent changes summary

This view should not include every settings group, every backup detail, or raw pipeline cards.

### Players

Primary question: Who is here, what are they doing, and who needs attention?

Content:

- online now
- recent sessions
- active and returning players
- quiet players
- known player profiles
- identity confidence
- player detail drawer

Game-specific extensions can appear here when they describe player activity. Palworld guild membership can be visible as context, but the guild investigation surface should remain game-scoped.

### Settings

Primary question: What happens if I change this?

Content:

- current readable settings
- confidence and source
- grouped configuration
- preview/diff surfaces
- safety gates and blocked reasons
- future change review dialogs

Settings should separate read confidence from write capability. Low-level metadata belongs behind expandable evidence.

### Backups

Primary question: Can I safely recover?

Content:

- latest backup state
- backup freshness
- recovery confidence
- missing evidence
- restore readiness
- future restore preview and confirmation flows

Backups should feel like a safety surface, not a file browser.

### History

Primary question: What happened?

Content:

- world history
- trusted World Events
- player and guild related events
- operational events scoped to the server
- filters for meaningful, quiet, and high-confidence history
- event detail drawer

History should preserve evidence and source confidence without making raw telemetry primary.

### Capabilities

Primary question: What can this console know or do?

Content:

- available read capabilities
- unavailable or unknown capabilities
- connector source
- last verified timestamps
- confidence by area
- technical evidence

Capabilities are low-priority in daily operation. They should be available, compact, and useful for trust and setup.

## Screen Hierarchy

### Level 1: Operator State

Highest visual weight. Answers what matters now.

Examples:

- health
- recommended action
- warnings
- current activity
- online players

### Level 2: Operating Context

Medium visual weight. Explains what changed and who is involved.

Examples:

- recent operations
- current players
- current event
- recent sessions
- community pulse

### Level 3: Supporting Evidence

Low visual weight. Supports trust after the operator chooses to inspect.

Examples:

- capabilities
- diagnostics
- telemetry
- configuration metadata
- raw evidence
- technical details

### Level 4: Deep Technical Reference

Hidden by default behind drawers, details panels, or Administration/Capabilities.

Examples:

- raw payloads
- connector internals
- log truth details
- REST/RCON evidence
- ingestion metadata

## Information Priority Rules

Highest priority information:

- current health
- recommended action
- warnings
- current activity

Medium priority information:

- recent operations
- current players
- current event

Low priority information:

- capabilities
- diagnostics
- telemetry
- configuration metadata
- raw evidence
- technical details

Low-priority information must not visually compete with operational summaries. Use smaller headings, compact rows, muted color, collapsible panels, or separate tabs.

## Primary Workflows

### Daily Check

1. Operator opens Overview.
2. Operator sees overall state and recommended next action.
3. If all worlds are healthy, no deeper navigation is required.
4. If a server needs attention, operator enters that server Overview.
5. Server Overview explains the warning, current activity, and next step.

### Investigate Server Warning

1. Operator starts from Overview or Operations.
2. Opens the affected server Overview.
3. Uses the relevant tab: Players, Settings, Backups, History, or Capabilities.
4. Expands supporting evidence only if needed.
5. Uses a drawer for entity or event detail without losing server context.

### Understand Player Activity

1. Operator opens server Players.
2. Scans online now, recent sessions, returning players, and quiet players.
3. Opens a player drawer.
4. Reviews identity confidence, session history, related events, and game-specific context.

### Review Settings Safely

1. Operator opens server Settings.
2. Sees read confidence and source.
3. Reviews grouped settings.
4. Opens details for evidence or preview.
5. Future write actions must require preview, backup state, safety gates, and confirmation.

### Confirm Recovery Confidence

1. Operator opens server Backups.
2. Sees latest backup state and recovery confidence.
3. Reviews missing evidence or warnings.
4. Opens detail for backup metadata.
5. Future restore actions must use dialogs with exact impact, source backup, and rollback assumptions.

### Audit What Happened

1. Operator opens History globally or within a server.
2. Filters by server, event type, confidence, or time.
3. Opens event drawer.
4. Reviews source, timestamps, evidence, related people, related guilds, and connected history.

## Visual Hierarchy Rules

- Use a single hero or summary band per primary screen.
- Put the recommended action near the health state, not at the bottom.
- Keep warning count and warning language visible but not theatrical.
- Put high-priority content above tabs or in the first tab.
- Do not place technical cards in the first visual row unless the screen is Operations, Administration, or Capabilities.
- Prefer compact tables and rows for evidence-heavy content.
- Avoid equal-card grids where every card has the same visual weight.
- Use muted surfaces for low-priority evidence.
- Use game artwork or game-aware accents to orient the operator, but never at the cost of legibility.
- Keep healthy states calm and current, not blank.

## Progressive Disclosure Rules

### Overview

Shows conclusion and routing. No dense evidence.

### Tabs

Separate distinct jobs. Use tabs when content answers different questions, not merely to hide overflow.

### Expandable Panels

Reveal supporting detail for the current question. Good for diagnostics, capability evidence, setting metadata, and backup evidence.

### Drawers

Preserve context during investigation. Good for player, guild, event, session, backup, and setting detail.

### Dialogs

Reserve for focused review, confirmation, and future write actions. Dialogs should explain impact, confidence, prerequisites, and reversal options where applicable.

## Component Philosophy

### Operator Summary

One component should answer: Is attention needed, and what should I do next?

It should combine state, warning, and recommendation without becoming a metrics wall.

### Server Attention Summary

Server Overview should use a reusable Server Attention Summary pattern across supported games.

It should answer "Does this server need my attention?" before showing secondary panels. The pattern should normalize game-specific data at the UI boundary and prioritize current health, attention items, supported next action, current activity, recent important change, and a small activity metric strip. It should not include capability matrices, raw telemetry, connector details, settings tables, or backup evidence by default.

### Server Hero

A server hero should establish game, server name, status, players online, last activity, and recommended action.

It may use game artwork, subtle atmosphere, or an icon system, but it must remain readable and operational.

### Status Strips

Status strips should provide compact confidence: online players, data freshness, warning count, latest event, backup freshness.

### Focused Tables

Use tables for repeatable operating lists: players, settings, backups, capabilities, history. Tables should have clear row actions that open drawers.

### Evidence Panels

Evidence panels are secondary. They should be compact, collapsible, and source-aware.

### Drawers

Drawers should focus on one entity or event. They should include evidence, related history, and clear return context.

### Cards

Cards are useful for repeated entities and summaries. They should not be the default solution for every section. Avoid long pages where unrelated cards compete equally.

## Examples Of Current Screen Changes

### Operator Workspace

Current problem: operator intelligence cards can appear as a wall of equally weighted cards.

Direction:

- lead with current state, server health, and community/player activity
- group ask/reason tools together
- move memory, timeline, debug, and raw current-state evidence into a supporting evidence group
- keep all existing functionality available

### Server Command Page

Current problem: command, settings, Palworld intelligence, backups, capability, and diagnostics can visually accumulate.

Direction:

- turn the selected server surface into tabs: Overview, Players, Settings, Backups, History, Capabilities
- keep the server hero stable above tabs
- show only the most important state and action on Overview
- move settings and backup evidence into their own views
- move connector and capability details behind Capabilities or Operations

### World History

Current strength: trusted history already uses filters and evidence drawers.

Direction:

- make History a focused server view
- keep evidence drawers
- preserve confidence and source visibility
- prevent history from becoming raw log browsing

### Palworld Settings

Current strength: settings read confidence and preview planning exist.

Direction:

- make Settings a focused view that answers safety and impact
- place raw setting metadata behind details
- separate read availability, write availability, and apply readiness
- make future write paths require backup confidence and explicit review

### Capabilities And Diagnostics

Current problem: diagnostics can compete with operator-facing state.

Direction:

- move capabilities into a low-priority focused view
- summarize capability confidence in plain language
- keep technical evidence available for maintainers
- avoid showing capability matrices in daily Overview unless something blocks trust

## Final Server IA Contract

Phase 11J locks the server workspace into six focused tabs. These tabs are a product contract, not a styling preference.

### Overview

Primary question: Does this server need my attention?

Belongs here:

- reusable Server Attention Summary
- current health
- attention items and warnings
- supported next action
- current activity
- recent important change
- a small metric strip

Does not belong here:

- capability matrices
- settings tables
- backup diagnostics
- connector implementation details
- raw telemetry
- full player, guild, character, or history evidence

### Players

Primary question: Who is here, what are they doing, and who needs attention?

Belongs here:

- Player Activity Summary
- Player Directory
- Game-Specific Context
- Supporting Evidence
- player detail entry points and drawers

Does not belong here:

- settings safety decisions
- backup readiness
- connector capability maps
- unrelated operations diagnostics

Palworld guilds, bases, save identity, and player profile evidence may appear here only when separated from live activity. Valheim characters, player identity, world-memory relationships, and character evidence may appear here only when separated from live activity.

### Settings

Primary question: What happens if I change this?

Belongs here:

- Change Impact Summary
- Active Configuration
- existing setting controls or calm unavailable states
- Configuration Evidence
- read path, write path, restart, validation, and rollback evidence

Does not belong here:

- live player activity
- world history
- backup recovery evidence except when it supports setting safety
- game-specific change planning for the wrong game

Palworld-only boost planning, apply-readiness, runtime audit, and config audit surfaces stay Palworld-only. Valheim uses read-only/reference settings coverage unless Valheim-specific settings semantics are actually added later.

### Backups

Primary question: Can I safely recover?

Belongs here:

- Recovery Readiness Summary
- existing recovery controls or calm unavailable states
- Backup History / Evidence
- backup diagnostics, safety warnings, validation steps, and rollback requirements

Does not belong here:

- settings controls unless they are recovery prerequisites
- player intelligence
- capability maps unrelated to recovery
- any fake restore capability

### History

Primary question: What happened?

Belongs here:

- Operator Timeline Summary
- Search / Exploration
- Supporting Evidence
- world memory, chronicle, trusted event evidence, session timeline, activity log, and event drawers

Does not belong here:

- current activity as the primary surface
- settings or backup controls
- capability maps
- raw logs above the trusted timeline summary

### Capabilities

Primary question: What can this console know or do?

Belongs here:

- Console Coverage Summary
- Available Capability Areas
- Technical Evidence / Diagnostics
- connector status, data confidence, feature availability, capability limitations, and low-priority technical reference

Does not belong here:

- daily health as a replacement for Overview
- live player activity as a replacement for Players
- write controls invented for parity
- game-specific panels from another game

## Cross-Game Parity Rules

Equivalent IA quality does not mean identical content. Palworld and Valheim should feel equally intentional, but they should not pretend to have the same data, mechanics, or operational surfaces.

- Palworld-specific panels must not appear on Valheim surfaces unless the UI explicitly explains them as unavailable reference material, and even then they should normally be replaced by Valheim-appropriate empty/reference states.
- Valheim-specific character, realm, and world-memory panels must not appear on Palworld surfaces.
- Palworld-only controls, readiness maps, identity review surfaces, boost planning, save identity review, runtime audit, config audit, and base capacity evidence stay scoped to Palworld.
- Valheim read-only/reference panels should use Valheim language and should not borrow Palworld operational labels.
- Missing data should use calm empty states that explain what is missing. Do not create fake parity by adding placeholder capabilities, recommendations, or actions.
- Shared summaries may normalize data at the UI boundary, but game-specific detail remains inside the correct game branch.

## Priority Rules

- Operator summaries come before controls.
- Live/current state comes before history.
- Game-specific context comes before raw evidence.
- Safety summaries come before configuration or recovery evidence.
- Trusted timeline summaries come before raw logs.
- Coverage summaries come before capability matrices and diagnostics.
- Diagnostics, telemetry, capabilities, configuration metadata, and raw evidence are quiet and low-priority unless they indicate real operator attention.

## Future Development Guardrails

- Do not add new same-weight card walls.
- Every new feature must be assigned to the correct top-level area, server tab, drawer, or dialog before implementation.
- If a feature crosses tabs, summarize it once in the highest-priority relevant tab and disclose details deeper.
- Each screen must preserve its primary question.
- New game-specific panels must include a game-scope decision: Palworld-only, Valheim-only, or truly shared.
- Shared components must accept normalized operator-facing inputs rather than leaking one game's implementation details into another game's surface.
- If a feature is technical, put it in Capabilities or supporting evidence unless it changes current health or attention.
- If a feature is historical, put it in History unless it is the single recent important change summarized on Overview.
- If a feature is player-related, start in Players and disclose detail through drawers or supporting evidence.
- Future write actions must remain behind preview, safety, backup/recovery context when relevant, confirmation, and history/audit visibility.

## Guidance For Future Feature Development

- Start every screen or component with the question it answers.
- Decide whether the feature belongs globally, per-server, inside a tab, in a drawer, or behind evidence.
- Keep game-specific concepts scoped to the games that use them.
- Do not add a new top-level card when a tab, row, drawer, or evidence panel would be clearer.
- Do not promote technical detail above operator state unless the screen is explicitly technical.
- Warnings must include why they matter and what the operator can do next.
- Recommendations must be factual and evidence-backed.
- Future write actions must include preview, safety gates, backup/recovery context when relevant, and history/audit visibility.
- Automation should have a review surface before it has prominent controls.
- Raw telemetry should remain inspectable, not primary.
- A healthy server should still feel alive through current activity, recent history, and community rhythm.

## Phase 11 Final Handoff

Phase 11 changed GameOps from a growing dashboard into an Operations Console IA.

What changed:

- established six top-level areas: Overview, Servers, Operations, Automation, History, Administration
- made Overview, Servers, Operations, History, and Administration live in the shell
- kept Automation planned until real automation data exists
- converted the selected server surface into focused tabs: Overview, Players, Settings, Backups, History, Capabilities
- introduced reusable summary/section patterns for attention, players, safety, and evidence surfaces
- separated Palworld and Valheim details while preserving equivalent IA quality
- added route-cue behavior from top-level work/history/reference rows into the correct server tabs
- documented and tested the IA contract so future work has placement rules before implementation

What Phase 11 intentionally did not change:

- no backend capabilities
- no new APIs
- no persistence or schema changes
- no connector changes
- no Palworld or Valheim behavior changes
- no automation behavior
- no new write actions
- no VPS deployment or service restarts

Feature placement decision guide:

- Put global health, current attention, and the first answer to "Is everything okay?" in Overview.
- Put server selection, comparison, and selected server investigation in Servers.
- Put active/current work in Operations.
- Put future automatic behavior in Automation only when loaded data proves real schedules, rules, queued automatic actions, disabled automation state, or automation runtime health exists.
- Put cross-operation records and trusted timeline summaries in History.
- Put read-only configuration, maintenance, capability, connected-system, and diagnostic reference in Administration.
- Put server-specific detail in the owning server tab, not in another top-level area.
- If a feature spans areas, summarize it once at the highest-priority surface and route to the owning detail surface.

Server tab placement decision guide:

- Overview answers whether the selected server needs attention.
- Players answers who is present, what they are doing, and who needs attention.
- Settings answers what happens if configuration changes.
- Backups answers whether recovery appears safe.
- History answers what happened on the selected server.
- Capabilities answers what the console can observe, infer, or support for the selected server.

Palworld and Valheim parity:

- Equivalent quality does not require identical content.
- Palworld guilds, bases, save identity, boost planning, runtime audit, config audit, and Palworld readiness panels stay Palworld-scoped.
- Valheim characters, realm context, and Valheim world-memory relationships stay Valheim-scoped.
- Shared components should normalize inputs at the UI boundary and avoid leaking one game's implementation language into the other game.
- Missing data should use calm empty/reference states rather than fake parity.

Automation remains planned because the current UI does not load real automation rules, enabled schedules, queued automatic actions, disabled automation state, or automation runtime health. Event-template drafts are manual dashboard previews and safety/reference surfaces; they do not make Automation live. Automation can become live only when existing loaded data can truthfully answer "What will happen automatically?" without inventing schedules, controls, or write behavior.

Known limitations:

- Automation is represented as planned intent only.
- Top-level History is a compact read-only summary, not a global Chronicle/search replacement.
- Administration is a read-only reference surface, not an admin control center.
- Route cues intentionally reuse existing server tabs; they do not create new routes.
- Browser QA covered local desktop/tablet/mobile widths, not VPS deployment.
- The production build still reports the existing Vite large chunk warning.

Phase 11 can close when this contract remains green in validation. Future feature work should begin by choosing the correct top-level area, server tab, drawer, or dialog before code is added.

## Phase 11A Boundary

This architecture does not add backend capabilities, Palworld behavior, connectors, automation, write actions, or server functionality. It reorganizes how existing and future functionality should be presented so GameOps can grow without becoming a wall of cards.
