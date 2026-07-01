# Deployment Hygiene

The VPS checkout should stay a clean source checkout. Build output, runtime JSON, local env files, connector state, and cache files should not appear in `git status`.

## Runtime Data

Production runtime data belongs under:

```sh
/srv/gameops-bridge/data
```

The API and connector now default to this directory when `NODE_ENV=production`. Local development defaults to `./data`, which is ignored by Git.

You can override the shared data directory with:

```sh
GAMEOPS_DATA_DIR=/srv/gameops-bridge/data
```

Specific store paths still override the shared directory when set:

- `SESSION_STATE_STORE_PATH`
- `KNOWN_PLAYER_STORE_PATH`
- `PALWORLD_TELEMETRY_STORE_PATH`
- `PALWORLD_PLAYERS_SUMMARY_PATH`
- `PLAYER_INTELLIGENCE_STORE_PATH`
- `PLAYER_ENGAGEMENT_ROLLUP_STORE_PATH`
- `PALWORLD_APPROVED_IDENTITIES_PATH`
- `PALWORLD_IDENTITY_LINKS_PATH`
- `PALWORLD_MILESTONE_TRANSITION_STORE_PATH`
- `EVENT_TEMPLATE_DRAFT_STORE_PATH`
- `GAMEOPS_OPERATOR_TIMELINE_PATH`

## Deploy Steps

From the VPS checkout:

```sh
git pull
npm install
npm --workspace apps/web run build
sudo systemctl restart gameops-api.service
sudo systemctl restart gameops-dashboard.service
curl -fsS http://127.0.0.1:3001/health
```

If the dashboard has a local health URL, check that too.

## Keeping Git Clean

Expected `git status --short` on the VPS should show no changes after deployment.

Do not commit:

- `.env` files, including `apps/web/.env.production`
- `config/*.local.json`
- runtime JSON such as `session-state.json`, `palworld-telemetry.json`, `operator.timeline.json`, or player rollup state
- generated `.js`, `.d.ts`, or `.map` files emitted under `src`
- `dist`, `build`, cache, connector state, or local app state directories

## Safe Cleanup For Existing VPS Checkouts

Do not delete runtime data. Move it into `/srv/gameops-bridge/data` first, then point the matching environment variable at the new path if needed.

For generated TypeScript outputs that are already tracked by Git, clean them with Git after this change is deployed:

```sh
git rm --cached apps/api/src/**/*.js apps/api/src/**/*.d.ts apps/api/src/**/*.js.map
git rm --cached apps/bot/src/**/*.js apps/bot/src/**/*.d.ts apps/bot/src/**/*.js.map
git rm --cached apps/connector/src/**/*.js apps/connector/src/**/*.d.ts apps/connector/src/**/*.js.map
git rm --cached packages/shared/src/**/*.js packages/shared/src/**/*.d.ts packages/shared/src/**/*.js.map
```

Those commands remove generated files from version control. They do not remove runtime data. Review `git status --short` before committing.
