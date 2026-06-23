# Palworld Settings Write Path Audit

Date: 2026-06-23

This audit documents whether GameOps Bridge can safely change Palworld settings today. It is intentionally read-only research. No write route, REST mutation, RCON command, config edit, scheduler, or restart workflow is implemented by this slice.

## Current Code-Proven Capabilities

### Palworld REST reads

GameOps has a working Palworld REST reader in `apps/connector/src/adapters/palworld/rest.ts`.

Implemented REST reads:

- `GET /players` through `fetchPlayers`
- `GET /metrics` through `fetchMetrics`
- `GET /settings` through `fetchSettings`

The connector tries `http://host:port{restPath}/{endpoint}` first, then falls back to `http://host:port/{endpoint}`. It sends Basic auth and accepts JSON. The connector runtime polls players, metrics, and settings together, then persists telemetry and latest settings snapshots.

Settings snapshots are persisted as observed JSON only. The telemetry store records latest settings and a settings-change history when the observed settings JSON changes. This is observation, not mutation.

### Palworld REST writes

No Palworld REST write path exists in this repo.

There is no code that calls a `POST`, `PUT`, `PATCH`, or `DELETE` Palworld settings endpoint. The current REST adapter only performs JSON `fetch` calls without a method override, so it uses GET.

The current code does not prove that Palworld REST exposes a supported settings update endpoint. Any REST write path must be treated as possible only after validation against the target Palworld server version and official API behavior.

### RCON

The shared config schema and setup wizard support Palworld connector mode `rcon` with:

- `rconHost`
- `rconPort`
- `rconPassword`

The setup verifier checks that those fields are present for an RCON-mode server.

There is no Palworld RCON client implementation in the runtime connector, no command execution service, and no settings-specific RCON command mapping. Current RCON support is configuration scaffolding only.

The audit cannot prove that RCON can change persistent Palworld settings. At most, RCON is a candidate path for future validation. It may only support runtime/admin commands, and settings persistence/restart behavior remains unknown.

### Config file editing

The shared config schema and setup wizard allow an optional Palworld `savePath`. The current local config includes a Palworld `savePath` value.

GameOps now has a read-only config file audit endpoint:

- `GET /servers/:serverId/palworld-config-audit`

The audit uses configured Palworld `savePath` or related paths to look for likely `PalWorldSettings.ini` locations, including platform-specific `Config/LinuxServer` and `Config/WindowsServer` directories. It reads only. It does not write, create backups, lock files, restart servers, or mutate runtime state.

The parser currently supports:

- common `OptionSettings=(Key=Value,...)` Palworld settings syntax,
- simple `key=value` INI lines,
- quoted strings, booleans, and numeric values.

The audit compares parsed file settings with the latest REST-observed settings snapshot when one exists. It reports matching keys, differing values, file-only keys, and REST-only keys.

This is still not a write capability. GameOps still has no Palworld settings writer, no authoritative settings-file proof, no file lock handling, no backup/restore workflow, and no restart workflow.

File editing is a candidate future path only if GameOps can prove:

- which file is authoritative for the server's settings,
- how to parse and preserve it safely,
- whether edits while the server is running are safe,
- whether a restart is required,
- how rollback is performed.

Current file-edit viability statuses:

- `not_viable`: no readable parseable settings file, unsupported server, or parse failure.
- `unknown`: file discovery/parsing may work, but REST comparison is missing or inconsistent.
- `possible_needs_backup_restart_validation`: a file was found, parsed, and matched REST-observed values, but backup and restart behavior are still unproven.

### Restart workflows

GameOps has Valheim-oriented journal/systemd configuration concepts and connector setup scaffolding, but there is no Palworld restart command abstraction.

There is no generic restart command, Docker restart integration, systemd restart integration, stop/start sequencing, health-gated restart workflow, or rollback-triggered restart workflow for Palworld settings.

## Questions Answered

### Does Palworld REST expose any setting update endpoint in our current code or known API shape?

In current code: no. GameOps only implements REST GET reads for players, metrics, and settings.

Known API shape from this repo: read-only. No write endpoint is represented in types, services, connector runtime, tests, or dashboard actions.

External API behavior remains unproven in this audit. Before any REST write MVP, validate against official Palworld server API documentation and a disposable server.

### Are settings live-editable or restart-required?

Unknown. Current code marks restart requirements as unknown. Observed settings can be grouped and risk-classified, but GameOps does not know whether changing any setting applies live or requires a restart.

Assume restart-required until proven otherwise for world, spawn, difficulty, access, and server lifecycle-sensitive settings.

### Would RCON support settings changes or only commands?

Unknown. Current code has RCON config fields but no RCON client or command map. The safe assumption is that RCON is not a settings write capability until a command is verified on a disposable Palworld server and its persistence behavior is known.

### Could config file editing work safely?

Possibly, but not as a write path yet. Current code can discover and parse likely settings files read-only, then compare parsed settings against REST snapshots. It still requires an authoritative file proof, writer, explicit path mapping, backups, atomic writes, validation, and restart handling. Editing a running server's settings file without proving reload semantics is unsafe.

### What backup/rollback would be required before any write?

Minimum rollback requirements:

- backup the authoritative settings source before every change,
- store previous values for every changed setting,
- keep the full proposed patch/diff,
- support restore from backup,
- verify server health after restore,
- define restart ownership and failure handling,
- never auto-change credentials/access fields.

### What is the safest MVP write path if we ever implement it?

The safest future MVP is not an immediate write button. It should be a validated, owner-confirmed file-edit workflow on a disposable server first, limited to a small allowlist of gameplay-balance settings.

Recommended MVP shape:

1. Add a read-only Palworld config file parser for the authoritative settings file.
2. Compare file settings with REST-observed settings and report mismatches.
3. Add a dry-run patch preview that writes nothing.
4. Add backup creation and restore verification.
5. Add a manually triggered, owner-confirmed apply path for one allowlisted setting group.
6. Add restart instructions/status before any automated restart.

REST write could become safer if an official settings mutation endpoint is confirmed and its restart/rollback semantics are documented. Until then, REST mutation should remain blocked.

## Read-Only Capability Status Added

The settings capability API now reports:

- `writePathStatus`
- `candidateWritePaths`
- `validationSteps`
- `rollbackRequirements`
- `unresolvedQuestions`

These fields are read-only audit status. They do not enable writes.

Current interpretation:

- Palworld REST with a settings snapshot: `possible_needs_validation`
- Palworld REST without a usable snapshot/config: `blocked_missing_config`
- Palworld RCON/file modes: candidate paths only, `possible_needs_validation` or `unknown` depending on mode
- Valheim/non-Palworld settings writes: `not_supported`

## Non-Negotiable Safety Limits

- No settings write route until a specific path is proven.
- No broad arbitrary key/value editor.
- No password/admin/access/whitelist/ban/kick/auth automation.
- No write without backup and rollback.
- No write without restart/recovery expectations.
- No write based only on dashboard draft templates.
