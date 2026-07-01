# Player Activity Import Preview

Sprint 5B adds a read-only preview for historical player activity. It scans the configured JSON stores and reports import candidates without writing or mutating any GameOps data.

## What It Scans

- Log Truth: `LOG_TRUTH_STORE_PATH`, default `log-truth.json`
- Session state: `SESSION_STATE_STORE_PATH`, default `session-state.json`
- Player intelligence rollups: `PLAYER_INTELLIGENCE_STORE_PATH`, default `player-intelligence-state.json`
- Known players: `KNOWN_PLAYER_STORE_PATH`, default `known-players.json`
- Palworld telemetry: `PALWORLD_TELEMETRY_STORE_PATH`, default `palworld-telemetry.json`

Relative paths resolve from `GAMEOPS_DATA_DIR`, or `/srv/gameops-bridge/data` when `NODE_ENV=production`.

## VPS Command

From `/root/gameops-bridge`:

```bash
NODE_ENV=production node --import tsx scripts/preview-player-activity-import.ts
```

To preview a single server:

```bash
NODE_ENV=production node --import tsx scripts/preview-player-activity-import.ts --server-id palworld-fantasy-1
```

The output includes candidate players, source stores, first and last seen timestamps, session-like evidence counts, confidence, and whether a future import would create or update player records.

## Safety

This preview does not call store mutation APIs and does not write files. Malformed or missing optional stores are reported in `scannedStores` rather than stopping the whole preview.
