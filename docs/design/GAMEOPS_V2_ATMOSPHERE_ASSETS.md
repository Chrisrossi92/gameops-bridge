# GameOps Bridge V2 Atmosphere Asset Specification

This document defines future static-image and looping-video asset requirements for the V2 atmosphere system. It is planning only. Do not add real images, videos, upload behavior, storage, CDN configuration, or backend contracts from this spec alone.

GameOps atmosphere should feel like a premium game control center: calm, dark-first, cinematic, and operational. Assets support the page question; they must never imply unsupported server state, automation, recommendations, player sentiment, or bot capabilities.

## Global Asset Rules

- Do not use copyrighted game screenshots, key art, UI captures, or trailer frames unless explicit rights and licensing allow it.
- Prefer original generated artwork, licensed stock, or internally produced imagery.
- Keep assets decorative unless a later phase defines a data-backed visual object.
- Avoid direct franchise logos, recognizable characters, protected monsters, or copied game environments.
- Every asset needs a still-image fallback, crop notes, focal-point metadata, and reduced-motion behavior.
- Every asset must remain readable under the current V2 hero overlay and dark shell.
- Test assets with real empty/error/loading states as well as loaded data states.

## Shared Technical Specs

Aspect ratios:

- Primary hero slot: `21:9` for mobile/tablet banner behavior.
- Desktop hero media: `16:10` compatible crop.
- Optional future wide shell background: `16:9` or `21:9`.

Minimum resolution:

- Static hero image: `2400x1029` for `21:9`.
- Static crop-safe master: `2560x1600` for `16:10`.
- Looping video: `1920x823` minimum for `21:9`; `2560x1097` preferred.
- Keep source masters larger than shipped derivatives when generation tools allow it.

Recommended formats:

- Static: AVIF primary, WebP fallback, PNG only for lossless tests or generated masters.
- Video: MP4/H.264 for broad support, WebM/VP9 or AV1 as optional secondary delivery.
- Poster frame: WebP or AVIF derived from the video.

Filename convention:

- Static: `gameops-v2-atmosphere-{preset}-{variant}-{ratio}.{ext}`
- Video: `gameops-v2-atmosphere-{preset}-{variant}-{ratio}-loop.{ext}`
- Poster: `gameops-v2-atmosphere-{preset}-{variant}-{ratio}-poster.{ext}`
- Examples: `gameops-v2-atmosphere-overview-cosmic-21x9.avif`, `gameops-v2-atmosphere-valheim-northern-21x9-loop.mp4`

Future repo location:

- Source masters, if committed: `apps/web/src/assets/gameops-v2/atmosphere/source/`
- Optimized shipped assets: `apps/web/src/assets/gameops-v2/atmosphere/`
- Asset metadata, if added later: `apps/web/src/assets/gameops-v2/atmosphere/manifest.ts`
- Do not add the manifest until a phase explicitly wires asset loading into `GameOpsHeroMedia`.

## Preset Catalog

### Overview / Command Bridge Cosmic

Intended feel: quiet command bridge looking into deep space; calm, capable, premium, and observant.

Static image prompt:

> A dark cinematic command bridge interior looking through a wide observation window into deep space, subtle console reflections, soft blue-white star glow, restrained premium sci-fi atmosphere, minimal detail, no people, no readable text, no logos, low contrast, dark navy and charcoal palette, quiet operational mood.

Looping video prompt:

> Slow ambient camera-still loop of a dark command bridge observation window with barely drifting stars, faint console glow, subtle light sweep across glass, premium quiet sci-fi control room, no characters, no text, no flashing lights, seamless 8 to 12 second loop.

Aspect ratios needed: `21:9`, `16:10`, optional `16:9`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: center at `50% 48%`; keep the brightest glow slightly above center.

Overlay guidance: medium overlay, `0.58` to `0.68`. The asset may have brighter stars, but the hero text must remain dominant.

Crop behavior: safe to crop sides. Avoid important detail at the far left or right.

Reduced-motion fallback: poster frame with static stars and console glow.

Must not appear: spaceship battles, lasers, planets dominating the frame, readable UI, brand logos, astronauts, busy dashboards.

Recommended format: AVIF/WebP static, MP4 loop with WebM optional.

Suggested filenames:

- `gameops-v2-atmosphere-overview-cosmic-21x9.avif`
- `gameops-v2-atmosphere-overview-cosmic-21x9-loop.mp4`
- `gameops-v2-atmosphere-overview-cosmic-21x9-poster.webp`

### Servers / World Observatory

Intended feel: strategic world selection observatory; multiple worlds monitored from a quiet operations room.

Static image prompt:

> Dark premium observatory control room with faint holographic world-orb silhouettes and a subtle tactical map table, distant horizon glow, restrained cyan and amber accents, no people, no labels, no text, cinematic low-light composition, calm strategic monitoring mood.

Looping video prompt:

> Seamless slow loop of a dark world observatory with faint orb silhouettes and a tactical map glow, gentle ambient light drift, subtle grid shimmer, no readable interface, no dramatic motion, no people, premium calm operations atmosphere.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 54%`; world-orb silhouettes can sit around the midline.

Overlay guidance: medium-high overlay, `0.62` to `0.72`, because map/grid details can get visually busy.

Crop behavior: keep orbs and horizon centered; side crop should only remove ambient darkness.

Reduced-motion fallback: static observatory with faint grid and orb silhouettes.

Must not appear: detailed solar systems, casino-like neon, readable labels, branded maps, weapon targeting UI, alerts implying real incidents.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-servers-observatory-21x9.avif`
- `gameops-v2-atmosphere-servers-observatory-21x9-loop.mp4`
- `gameops-v2-atmosphere-servers-observatory-21x9-poster.webp`

### Valheim / Northern Forest

Intended feel: quiet northern forest at night; cold air, mist, pine depth, aurora restraint.

Static image prompt:

> Dark northern pine forest at night, faint aurora behind trees, cold mist near the ground, moonlit fog, cinematic premium fantasy realism, subdued teal and indigo palette, no characters, no buildings, no game logo, no recognizable game screenshot, calm atmospheric depth.

Looping video prompt:

> Slow seamless loop of a moonlit northern pine forest with restrained aurora movement and low drifting mist, dark premium atmosphere, no characters, no creatures, no fast motion, no visible game branding, subtle cold-air ambience.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 48%`; aurora should sit upper center, mist lower center.

Overlay guidance: medium overlay, `0.58` to `0.68`. Preserve enough pine silhouette contrast to distinguish from Palworld.

Crop behavior: trees may crop at sides; keep aurora and mist readable in center crop.

Reduced-motion fallback: static aurora and mist composition.

Must not appear: Viking characters, longships, branded armor, copied Valheim screenshots, monsters, combat, bright green aurora bands dominating the slot.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-valheim-northern-forest-21x9.avif`
- `gameops-v2-atmosphere-valheim-northern-forest-21x9-loop.mp4`
- `gameops-v2-atmosphere-valheim-northern-forest-21x9-poster.webp`

### Palworld / Fantasy Forest

Intended feel: quiet fantasy world at dusk; warm torch glow, fog, magical depth, restrained wonder.

Static image prompt:

> Dark fantasy forest at dusk with soft drifting fog, faint warm torchlight glow in the distance, layered canopy silhouettes, subtle magical dust in the air, premium calm atmosphere, no creatures, no characters, no logos, no copied game style, subdued greens, amber, and deep violet shadows.

Looping video prompt:

> Seamless slow loop of a dusky fantasy forest with low fog drifting, faint warm torch glow pulsing gently, tiny restrained magical particles, no characters, no creatures, no readable text, no fast sparkle effects, premium dark atmospheric mood.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 50%`; warm glow can live right of center, fog lower center.

Overlay guidance: medium-high overlay, `0.62` to `0.72`, to prevent warm light and particles from overpowering content.

Crop behavior: canopy and trunks may crop at sides; keep glow and fog visible in center crop.

Reduced-motion fallback: static forest with fog and torch glow.

Must not appear: recognizable creatures, monster silhouettes, copied Palworld screenshots, cartoon mascot style, bright fairy particles, player-facing achievement visuals.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-palworld-fantasy-forest-21x9.avif`
- `gameops-v2-atmosphere-palworld-fantasy-forest-21x9-loop.mp4`
- `gameops-v2-atmosphere-palworld-fantasy-forest-21x9-poster.webp`

### Players / Campfire Roster Room

Intended feel: quiet gathering place for checking who is around; warm, alive, understated.

Static image prompt:

> Dark cinematic roster room or campfire gathering space, soft ember glow, vague seated silhouettes as environmental shapes only, warm light on wood and stone, no identifiable faces, no readable names, no UI, premium operational calm, restrained amber and charcoal palette.

Looping video prompt:

> Seamless slow loop of a quiet campfire roster room with gentle ember glow and subtle shadow movement, no people in focus, no readable boards, no dramatic flames, no tavern clutter, premium dark gathering atmosphere.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 52%`; ember glow lower center.

Overlay guidance: medium-high overlay, `0.64` to `0.74`, because warm glow can compete with hero text.

Crop behavior: keep fire/ember glow in lower center; silhouettes should remain abstract and crop-safe.

Reduced-motion fallback: static ember-lit room.

Must not appear: readable roster boards, named players, faces, social-network UI, tavern party visuals, bright flame bursts.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-players-roster-room-21x9.avif`
- `gameops-v2-atmosphere-players-roster-room-21x9-loop.mp4`
- `gameops-v2-atmosphere-players-roster-room-21x9-poster.webp`

### Events / War-Room Timeline Table

Intended feel: calm operations table where past and upcoming events are tracked; strategic, quiet, alive.

Static image prompt:

> Dark premium operations war-room table with faint timeline lines, subtle calendar grid depth, soft tactical table glow, tiny restrained markers, no readable labels, no maps of real places, no weapons, no people, calm event-tracking atmosphere.

Looping video prompt:

> Seamless slow loop of a dark tactical timeline table with faint line pulses and gentle calendar grid glow, restrained important-marker pulse, no readable text, no alarms, no fast blinking, no combat visuals, premium quiet operations mood.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 46%`; table glow lower center, timeline line crossing center.

Overlay guidance: high overlay, `0.66` to `0.76`, to keep linework from becoming noisy.

Crop behavior: center timeline table and markers; side crop can remove peripheral grid.

Reduced-motion fallback: static table with faint markers.

Must not appear: military aggression, weapons, emergency alarms, red alert panels, readable calendars, automation controls that do not exist.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-events-war-room-timeline-21x9.avif`
- `gameops-v2-atmosphere-events-war-room-timeline-21x9-loop.mp4`
- `gameops-v2-atmosphere-events-war-room-timeline-21x9-poster.webp`

### Community / Village Settlement

Intended feel: peaceful settlement at night; active without being busy, operational rather than social-network-like.

Static image prompt:

> Dark peaceful village settlement at night, distant roof silhouettes, soft window lights, faint smoke or mist, warm gathering glow, no crowds, no faces, no text, no fantasy festival clutter, premium restrained community activity atmosphere.

Looping video prompt:

> Seamless slow loop of a quiet night settlement with faint smoke drift and soft window lights gently shifting, no visible characters, no readable signs, no busy market activity, understated warm community ambience.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `50% 55%`; settlement lights lower center.

Overlay guidance: medium-high overlay, `0.62` to `0.72`, to prevent window lights from becoming too prominent.

Crop behavior: buildings may crop at sides; keep main light cluster lower center.

Reduced-motion fallback: static settlement with smoke implied but not animated.

Must not appear: festivals, crowds, social feeds, achievement banners, medieval parody, readable signage, brand marks.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-community-settlement-21x9.avif`
- `gameops-v2-atmosphere-community-settlement-21x9-loop.mp4`
- `gameops-v2-atmosphere-community-settlement-21x9-poster.webp`

### Settings / Maintenance Bay

Intended feel: clean maintenance bay where systems are checked and kept reliable; quiet, technical, premium.

Static image prompt:

> Dark clean maintenance bay or workshop with soft toolbench glow, faint blueprint grid lines, subtle machine status lights, organized technical depth, no readable text, no brand logos, no people, premium calm reliability atmosphere, charcoal, slate, and restrained teal accents.

Looping video prompt:

> Seamless slow loop of a dark maintenance bay with subtle status lights and faint blueprint grid glow, gentle toolbench light drift, no readable labels, no alarms, no busy machinery, no dramatic sparks, premium quiet technical atmosphere.

Aspect ratios needed: `21:9`, `16:10`.

Minimum resolution: `2400x1029` static; `1920x823` video.

Focal point guidance: `52% 48%`; bench glow mid-to-lower center, status lights offset.

Overlay guidance: high overlay, `0.66` to `0.76`, because grids and lights can compete with settings copy.

Crop behavior: keep bench glow and grid centered; side crop can remove tools or wall detail.

Reduced-motion fallback: static maintenance bay with status lights visible.

Must not appear: superhero lab imagery, sparks, explosions, readable controls, edit/upload controls, unsupported write actions, brand marks.

Recommended format: AVIF/WebP static, MP4 loop.

Suggested filenames:

- `gameops-v2-atmosphere-settings-maintenance-bay-21x9.avif`
- `gameops-v2-atmosphere-settings-maintenance-bay-21x9-loop.mp4`
- `gameops-v2-atmosphere-settings-maintenance-bay-21x9-poster.webp`

## Free Or Cheap Asset Generation Workflow Options

- CSS-first prototype: keep current CSS atmospheres as the composition reference before generating assets.
- Local/open model image generation: use a locally available image model when licensing and hardware allow it. Save prompts and seeds with the source asset notes.
- Low-cost hosted generation: generate stills first, then upscale and crop manually. Keep outputs original and avoid prompts requesting copyrighted game screenshots or named franchise art styles.
- Stock asset kitbash: use properly licensed atmospheric backgrounds, then crop, grade, and blur them into a decorative hero treatment.
- Video from still: create a still first, then use subtle parallax, mist, light drift, or slow texture movement to create a short loop. Keep a poster frame from the same source.
- Manual CSS/video hybrid: use a static image plus CSS overlay motion where possible instead of expensive generated video.

Recommended workflow:

1. Generate or source one static `21:9` candidate.
2. Crop-test it in the existing `GameOpsHeroMedia` slot at desktop, tablet, and mobile.
3. Tune overlay opacity and focal point metadata.
4. Generate a poster frame.
5. Only then create a looping video variant if the still succeeds.
6. Add reduced-motion behavior before shipping any video.

## Asset Testing Rules Before Commit

- Verify the asset on Overview, top-level pages, and selected-server pages that use the preset.
- Test desktop, tablet, and mobile viewport widths.
- Test normal mode and Design Mode.
- Test empty, loading, and error states; error text must remain visible and must not blend into red/orange atmosphere.
- Test `prefers-reduced-motion: reduce`; video or animation must stop or be replaced by a poster.
- Confirm hero text, status pills, and primary actions remain readable within five seconds.
- Confirm mobile crop does not hide the focal point or create an unrecognizable dark block.
- Confirm no copyrighted game screenshot, logo, character, creature, UI, or readable brand mark is present.
- Confirm file sizes are acceptable before commit. Prefer optimized AVIF/WebP and compressed video derivatives, not raw generation outputs.
- Keep source prompts, generation settings, license notes, and crop metadata with the asset PR.

## Recommended First Asset

Start with Overview / Command Bridge Cosmic.

Reasons:

- It is the broadest, safest brand-setting surface.
- It does not depend on a specific game identity.
- It validates the hero media pipeline, overlay behavior, reduced-motion fallback, and crop metadata before game-specific assets add more risk.
- It can remain abstract without implying fake operational state.
