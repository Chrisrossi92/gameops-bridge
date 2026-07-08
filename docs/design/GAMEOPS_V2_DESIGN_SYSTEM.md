# GameOps Bridge V2 Design System

GameOps Bridge V2 starts with a reusable foundation, not page-by-page decoration. The interface should feel like a premium game control center: dark-first, calm, atmospheric, minimal, and progressively disclosed.

The primary operator questions are:

- Is my server healthy?
- Who is playing?
- What just happened?
- What needs my attention?
- How do I create a great experience for my community?

## Phase V2.1 Scope

V2.1 adds the shared foundation and applies it only to the Overview/home dashboard. Existing data contracts, routes, and feature behavior remain unchanged.

The first implementation lives in:

- `apps/web/src/gameops-v2.tsx`
- `apps/web/src/gameops-v2-tokens.ts`
- `apps/web/src/index.css`
- `apps/web/src/App.css`
- `apps/web/src/App.tsx`

## Design Tokens

V2 tokens are CSS variables prefixed with `--go-` in `apps/web/src/index.css`.

Token groups:

- Spacing: page, section, and card rhythm.
- Radii: shell, cards, controls, and pills.
- Typography: hero, title, body, and caption scale.
- Surfaces: atmospheric background, panels, strong panels, and glass layers.
- Borders: quiet and strong borders.
- Shadows/glow: shell depth, cards, and restrained accent glow.
- Motion: fast/base timing and shared easing.
- Server accents: neutral, healthy, warning, offline, Palworld, and Valheim.

Use these tokens before adding new literal colors, spacing, radii, shadows, or timing values.

## Components

### `GameOpsShell`

The atmospheric shell for V2 pages. It owns the dark control-center background and static background layer support. Future animated or image-backed layers should be added inside this component or its CSS, not directly inside pages.

### `GameOpsPage`

The content rhythm container. It sets the V2 max-width, page padding, and vertical spacing.

### `GameOpsHero`

The first read of a screen. It answers one major question, includes the primary object or scope, and exposes one obvious primary action.

### `GameOpsSection`

A named content band with an optional eyebrow, description, and actions. Use it to separate primary information, quick actions, recent activity, and details.

### `GameOpsCard`

A reusable control-center surface. Cards summarize meaningful objects, not tiny metrics. Avoid walls of equally weighted cards.

### `GameOpsPrimaryAction`

The standard V2 action button. Use one primary action per screen; secondary actions route to supporting surfaces.

### `GameOpsStatusPill`

A compact state label. Keep labels short. Do not use status pills as explanations.

### `GameOpsActivityList`

A factual list for recent activity, current work, or history previews. Items should be source-backed and should not invent insight.

### `GameOpsAtmosphereFrame`

The structural container for cinematic atmosphere. It owns preset classes, theme classes, overlay opacity, focal point, and crop metadata. Use it for future static images, looping videos, or animated gradients instead of building one-off media wrappers inside pages.

### `GameOpsHeroMedia`

The hero media slot for V2 pages. It renders clean placeholder atmosphere in normal mode and is ready for future static image or muted looping video assets. Every top-level V2 hero should pass a source-backed page preset and a short label. Do not add real assets, upload behavior, storage, or generated imagery unless a later phase explicitly requests it.

### `GameOpsWorldBackdrop`

The layered backdrop surface inside an atmosphere frame. It provides CSS-only gradients, atmospheric depth, and reduced-motion-safe hooks while no real art assets are present.

### `GameOpsDesignSlot`

The frontend-only design-mode overlay for future creative tooling. It may show placeholder controls such as Replace Background, Adjust Crop, Focal Point, and Overlay only when Design Mode is enabled. These controls must not imply saved settings until persistence exists.

## Page Organization

V2 top-level surfaces should live in `apps/web/src/v2/pages/` once they have a stable structure. Keep `App.tsx` responsible for application state, data fetching, global navigation, and route/tab handoff. Page components should own page-specific view models, local grouping, and display-only helper logic.

Current extracted pages:

- `EventsHistoryPage.tsx`: top-level Events / History surface.
- `PlayersHubPage.tsx`: fleet-wide top-level Players hub.
- `CommunityPage.tsx`: top-level Community surface.
- `SettingsMaintenancePage.tsx`: top-level Settings / Administration surface.
- `ServerOverviewPage.tsx`: selected server Overview surface.

Rules:

- Do not move backend fetches into V2 page components during design-only phases.
- Pass routing callbacks explicitly, such as opening a server tab or switching top-level areas.
- Keep page props typed around small view models or shared V2 types rather than one-off untyped bags.
- Keep shared visual primitives in `gameops-v2.tsx`; page files may define private helpers only for their surface.
- If a helper is used by multiple V2 pages, promote it to a clearly named V2 utility file rather than importing from `App.tsx`.
- Shared utility candidates include game labels, status-tone mapping, relative time formatting, and event/activity grouping.
- Extraction must not change copy, visual structure, keyboard behavior, data contracts, or route access unless a phase explicitly asks for that change.

`apps/web/src/v2/utils.ts` is for small pure helpers shared by multiple V2 pages. Use it for stable formatting and mapping such as game labels, server-state tone mapping, relative time, duration labels, player-key normalization, settings capability labels, and common activity fallback labels. Do not move page-specific view-model assembly, route callbacks, fetches, or product decisions into this utility module.

## Overview Structure

The V2.1 Overview is organized as:

1. Hero: answers "How are all my worlds?" or "Which server needs attention?"
2. Primary Information: world/server cards with online players, weekly activity, status, and last activity.
3. Quick Actions: routes to existing Operations, History, and Administration views.
4. Recent Activity: factual loaded activity with navigation into server history.
5. Expandable Details: API, fleet counts, loaded source counts, and freshness metadata.

## Shell And Navigation

V2.2 defines the primary shell as a calm control-center frame with six primary destinations:

- Overview: the five-second answer for the full operation.
- Servers: world health, world switching, and selected-server detail.
- Events: current work, recent activity, history, schedules, and future event automation when real data exists.
- Players: player entry points grouped by world, routing into existing server player detail.
- Community: community activity grouped by world, routing into server, guild, player, and history surfaces.
- Settings: configuration, backups, capabilities, administration, and technical reference.

Primary navigation should stay short and stable. Do not add primary nav items for implementation concepts, debug tools, or one-off features. If a surface is not one of the six primary destinations, place it under the closest owner:

- Technical/admin/debug views belong under Settings unless they are active incidents.
- Server-specific views belong under Servers.
- Player-specific views belong under Players, then the owning server.
- Event, schedule, history, and current-work views belong under Events.
- Guild, identity, engagement, and community summaries belong under Community or Players depending on the primary object.

The world switcher is a navigation aid, not a data product. It can show configured worlds, selected world, current loaded state, and online player counts from existing fleet summaries. It must not invent health, recommendations, or hidden controls.

Mobile shell rules:

- Keep primary navigation horizontally scrollable or stacked rather than cramped.
- Keep world switching available without forcing every server detail into the first viewport.
- Preserve the same information architecture as desktop; do not create mobile-only destinations.
- Favor compact labels and honest status over dense metadata.

## Server Overview Pattern

The selected server Overview answers one question: "How is this specific world doing?"

Use this structure:

1. Hero: server name, game identity, state, one recommended next route, and four glanceable metrics.
2. Primary Information: one dominant health card, then supporting player and recovery cards.
3. Quick Actions: routes to existing server tabs only. For V2.3 these are Players, Backups, Settings, and History.
4. Recent Activity: loaded activity records first, then recent server events if activity records are unavailable.
5. Expandable Details: connector, telemetry, configuration, data freshness, settings count, backup evidence, highlights, and capabilities.

Rules:

- Do not redesign non-overview server tabs during the server overview pass.
- Keep the primary action singular. Secondary actions can route to existing tabs.
- Do not add restart, backup creation, restore, write, schedule, or automation controls unless real supported functionality already exists.
- Backup/save confidence must come from existing recovery evidence. If no evidence exists, say that it is unknown.
- Empty activity states must say which data is missing rather than implying the server is quiet.
- Technical diagnostics stay in expandable details unless they create active attention.

## Players Pattern

The Players surface answers one question: "Who is playing, who has been active, and who should I pay attention to?"

Use this structure:

1. Hero: player scope, online count, recent activity count, known player count, and source-backed attention count.
2. Primary Information: current players first, recently active players second, attention items third.
3. Master/Detail: a browsable player list beside a selected player preview/detail panel.
4. Game Context: guilds, characters, bases, save links, or game-specific identity evidence after the primary player list.
5. Expandable Details: raw telemetry, known-player records, identity IDs, and diagnostics.

Rules:

- Do not put a giant player table as the first read.
- Online players sort above offline players when existing data supports it.
- Attention labels must come from loaded identity, confidence, save-link, or source-backed review state.
- Do not invent churn, toxicity, VIP, risk, or moderation conclusions.
- Preserve access to existing player detail, session, identity, guild, save, and raw telemetry records.
- Empty states must say whether player sessions, telemetry, known-player records, or identity evidence is missing.

## Fleet-Wide Players Hub Pattern

The top-level Players hub answers one question: "Who is active across all my worlds?"

Use this structure:

1. Hero: online count, recently active count, known-player coverage, and source-backed returning/quiet counts.
2. Fleet Master/Detail: online players first, then recently seen players, grouped by world/server.
3. Selected Player Preview: player name, world, status, activity, source label, and route into the existing server Players tab.
4. World Context: one card per world with known-player coverage and routes to server-specific Players.
5. Expandable Details: loaded source counts, row counts, online counts, and raw-access notes.

Rules:

- Do not show a giant player table as the first read.
- Keep the hub operational and founder-facing, not player-facing.
- Do not invent risk scores, churn predictions, player value, moderation status, achievements, or unsupported controls.
- Player detail routes must preserve existing server-specific Players tabs.
- Player rows must come from loaded telemetry, player intelligence, community activity, sessions, or known-player records.
- Empty states must say which source is missing: configured worlds, telemetry, player intelligence, community activity, or known-player records.

## Events And History Pattern

The Events surface answers one question: "What just happened, what is scheduled, and what needs attention?"

Use this structure:

1. Hero: current work count, history record count, warning count, and schedule draft count.
2. Timeline: current attention first, then cross-server history grouped by recency.
3. Detail Preview: selecting a timeline item shows source, type, time, and the route to existing server detail.
4. Scheduled / Upcoming: show only existing schedule labels from dashboard event-template drafts. Label them as draft-only.
5. Expandable Details: raw source counts, server-history routing, session timelines, chronicle evidence, and diagnostics.

Rules:

- Do not show dense raw logs as the first read.
- Do not imply automation is active unless real scheduled automation data exists.
- Event-template drafts are preview/draft evidence, not scheduled jobs.
- Preserve access to server History tabs for raw timelines, chronicle search, and event evidence.
- Group timeline rows by useful operator language such as "Needs attention," "Live now," "Today," "This week," and "Time unknown."
- Empty states must say which source is missing: current work, activity logs, recent events, freshness history, or schedule draft labels.

## Settings And Maintenance Pattern

The Settings surface answers one question: "How is everything configured, and where do I go to maintain it?"

Use this structure:

1. Hero: configured server count, readable settings count, backup evidence count, and capability count.
2. Maintenance By World: one readable object per server with configuration, recovery, and capability status.
3. Reference Areas: Configuration, Backups / Recovery, Capabilities, and Diagnostics.
4. Quick Routes: route to existing server Settings, Backups, Capabilities, and History tabs.
5. Expandable Details: raw source labels, read/write path state, data freshness, and technical reference.

Rules:

- Do not present a giant admin dump as the first read.
- Do not imply editing, writes, restarts, restores, or backup creation unless real controls already exist.
- Write-path visibility is evidence, not permission to change settings.
- Backup readiness is evidence, not proof that a backup was created.
- Capabilities and diagnostics belong below configuration and recovery unless they are actively blocking trust.
- Empty states must explain whether configured server data, settings capability data, backup evidence, or diagnostics are missing.

## Atmosphere System

V2.12 introduced cinematic atmosphere structure without real media assets, upload, or storage. V2.13 added CSS-generated atmospheric treatments for the hero media slots. Atmosphere is a reusable shell capability, not a redesign of page content.

Atmosphere preset catalog:

- `overview` with `gameops-theme-overview`: command bridge / cosmic. Used by the top-level Overview hero only.
- `vanilla` with `gameops-theme-servers`: world selection / observatory. Used by the top-level Servers fleet hero only.
- `valheim` with `gameops-theme-valheim`: northern lights / mist / pine. Used by selected Valheim server Overview heroes only.
- `fantasy` with `gameops-theme-palworld`: magical forest / dusk fog / torchlight. Used by selected Palworld server Overview heroes only.
- `players` with `gameops-theme-players`: roster room / campfire gathering. Used by the top-level Players hub hero only.
- `events` with `gameops-theme-events`: timeline / calendar / war room. Used by the top-level Events hero only.
- `community` with `gameops-theme-community`: village / settlement activity. Used by the top-level Community hero only.
- `settings` with `gameops-theme-settings`: workshop / maintenance bay. Used by the top-level Settings hero only.

Theme class rules:

- Every real atmosphere treatment must be scoped to a `gameops-theme-*` class on `GameOpsHeroMedia`.
- Presets describe the broad art direction; theme classes define the exact surface or game treatment.
- Do not style a preset broadly when a narrower theme class exists. For example, Palworld uses the `fantasy` preset but must be styled through `gameops-theme-palworld`.
- Top-level page themes must not affect selected server pages, and selected server themes must not affect top-level pages.
- Server-specific themes may only use existing game identity. They must not imply server state, health, player count, or recommendations.

CSS layer rules:

- Reuse shared atmosphere structure before adding page-specific CSS. Current shared layers include the atmosphere frame, world backdrop, hero media placeholder, pseudo-element setup, variable-driven drift animation, and variable-driven line pulse animation.
- Theme blocks may define gradients, silhouettes, glow colors, background positions, and animation durations.
- Keep visual behavior scoped to the hero media slot. Do not add page-wide decorative effects unless a later phase explicitly asks for it.
- Avoid adding more one-off keyframes when an effect can use `gameopsAtmosphereDrift` or `gameopsAtmosphereLinePulse` with variables.

Hero media slot rules:

- Add page atmosphere through `GameOpsHeroMedia` in the `GameOpsHero` media slot.
- Preserve the screen question, primary action, metrics, and page hierarchy.
- Use `preset`, `themeClassName`, `overlayOpacity`, `focalPoint`, and `crop` metadata instead of page-specific CSS when possible.
- Static images and looping videos must be decorative unless they communicate a real product object. Use empty `alt` text for decorative assets.
- Video assets must be muted, looping, non-blocking, and reduced-motion safe.
- Overlay opacity must keep text, status, and action controls readable within five seconds.
- Server-specific atmospheres may use existing game/server identity only. Do not invent world state from the visual treatment.

Motion intensity rules:

- Motion must be slow, ambient, and secondary to operational information.
- Prefer 14 seconds or longer for glow/line pulses and 38 seconds or longer for background drift.
- Do not use rapid flashing, looping attention-grabbing motion, confetti-like particles, or game-like reward effects.
- Use opacity, slight translation, scale, or background-position drift. Avoid large object movement.
- Motion may suggest atmosphere only; it must not suggest a live operational state unless that state is backed by existing data and represented elsewhere in the UI.

Reduced-motion requirements:

- Every animated atmosphere layer must remain useful as a static composition.
- The global `prefers-reduced-motion: reduce` block must disable animation for atmosphere frames, backdrops, media placeholders, pseudo-elements, and placeholder lines.
- Do not rely on animation for contrast, legibility, or meaning.
- New atmosphere animations must use selectors already covered by the reduced-motion block or extend that block in the same change.

Visual QA tuning rules:

- Validate atmosphere slots at desktop, tablet, and mobile widths before changing a preset. The content hierarchy must remain stronger than the media slot.
- Below the shell breakpoint, hero media should behave like a restrained cinematic banner instead of a full panel. Keep the responsive slot capped and wide so mobile heroes do not push primary actions too far down the page.
- Keep top-level page themes visually distinct through composition and color temperature, but do not increase saturation or motion just to make them louder.
- If local data cannot render a selected-server theme, inspect the scoped CSS and verify the theme in a data-backed environment before shipping asset-specific polish.
- Keyboard focus inside hero areas must remain visible against both dark gradients and bright glow layers. Reuse explicit `:focus-visible` outlines for V2 hero actions.
- Treat red or warning states as product information, not atmosphere. Do not soften or hide real error/status text with atmospheric overlays.

Design Mode rules:

- Design Mode is frontend-only until a later persistence phase.
- Normal mode must show clean media with no editing controls.
- Design Mode may reveal subtle placeholder controls for replacing background, adjusting crop, focal point, and overlay.
- Placeholder controls should be disabled or no-op until real save/upload/storage behavior exists.
- Do not add backend contracts, upload endpoints, storage buckets, or asset manifests as part of atmosphere structure.

Future asset requirements:

- Prefer one high-quality hero asset per preset before adding page-specific variants.
- Provide crop and focal-point metadata with every asset.
- Provide still-image fallbacks for every video or animated background.
- Keep motion slow, subtle, and optional; never let motion compete with operational status.
- Validate desktop and mobile framing before shipping each asset.
- Real assets must not replace source-backed product information. Atmosphere remains decorative unless a future phase defines a real data-backed visual object.
- Do not add upload, storage, CDN, or asset manifest behavior until a backend-backed asset phase is explicitly approved.

## Community Pattern

The Community surface answers one question: "What is happening socially across my worlds?"

Use this structure:

1. Hero: online count, active-week count, known-player count, world activity count, and one route into Players.
2. World Activity: grouped by server/world with online players, recently active players, returning players, quiet players, and latest loaded activity.
3. Groups / Guilds / Bases: show only records already loaded by existing game-specific sources. If top-level summaries do not include those records, explain where the existing server detail lives.
4. Recent Activity: factual player activity and activity-log records with routes into existing server Players or History views.
5. Expandable Details: source counts, warnings, recent events, raw activity counts, and game-specific access notes.

Rules:

- Keep Community operational. It should feel like world activity awareness, not a social network.
- Do not invent sentiment, community health scores, achievements, moderation claims, or bot capabilities.
- Prioritize who is active and which worlds feel alive before historical or raw technical evidence.
- Guild, base, character, identity, and session details must remain source-backed and route to existing server tabs when they are not available in top-level summaries.
- Empty states must say whether configured worlds, player activity, group records, or activity-log sources are missing.

## Accessibility And Responsive Rules

V2 surfaces should keep the control-center feel without becoming difficult to operate by keyboard, touch, or assistive technology.

Keyboard and focus:

- Every interactive V2 control must be reachable with the keyboard and have a visible `:focus-visible` state against dark hero and card backgrounds.
- Use native `<button>`, `<a>`, `<summary>`, `<nav>`, `<main>`, and heading elements before adding ARIA.
- Use `aria-current` for route-like navigation and `aria-pressed` for in-page selectable rows.
- Disable primary actions when their existing target data is absent instead of leaving a focusable no-op.
- Details summaries must have visible focus rings and touch-sized hit areas because raw diagnostics live behind progressive disclosure.

Responsive behavior:

- Keep touch targets at least 44px tall for V2 actions, nav items, selectable rows, and disclosure summaries.
- Horizontal mobile nav rails may scroll, but they must use containment, scroll padding, and gentle snap behavior so the shell does not feel loose.
- Atmosphere media should stay secondary on narrow screens. Use the responsive banner treatment unless a future asset phase explicitly validates a different crop.
- Avoid fixed-width text or metadata columns that can force horizontal page overflow. Prefer `minmax(0, 1fr)`, wrapping labels, and stacked mobile rows.

State communication:

- Loading, empty, and error states must be plain and source-backed. Say what data is missing, still loading, or unavailable.
- Do not use atmosphere overlays to hide real errors or warnings.
- Metric groups need specific accessible labels for the current surface, not generic "Overview" labels copied between pages.

## Principles

- One major question per screen.
- One obvious primary action per screen.
- Important information should be understandable within five seconds.
- No wall of equally weighted cards.
- Progressive disclosure is the default.
- Whitespace is intentional.
- Motion is subtle and should not distract.
- Dark atmosphere supports focus; it must not reduce readability.
- Technical evidence remains available, but it should not dominate the first read.
- Do not add fake AI features, invented recommendations, or unsupported insights.

## Rules For Future Codex Agents

- Extend `apps/web/src/gameops-v2.tsx` before creating one-off V2 page components.
- Use `--go-` tokens before adding new CSS literals.
- Keep backend contracts and response schemas unchanged for design-only phases.
- Apply V2 incrementally to one surface at a time.
- Preserve existing navigation and data visibility when restyling a surface.
- Put raw diagnostics, connector details, and technical evidence in details, drawers, or lower-priority sections.
- If a page needs game-specific atmosphere, use server accent tokens and scoped classes; do not fork the entire layout system.
- Do not imply operational controls unless real controls already exist.
- Empty states must say what data is missing and what that means.
- Before finishing UI work, run the existing frontend typecheck, lint, and build commands.
