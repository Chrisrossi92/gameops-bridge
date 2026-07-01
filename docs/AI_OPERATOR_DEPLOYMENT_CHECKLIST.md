# AI Operator Deployment Checklist

Use this checklist to deploy and verify the read-only AI Operator on the VPS.

## Pre-Deploy

- Confirm the API process has `NODE_ENV=production`.
- Create `/srv/gameops-bridge/config/operator.local.json` from `config/operator.vps.example.json`.
- Confirm `operator.local.json` contains only safe read-only paths:
  - PM2 stdout/error logs
  - project repository directories in `projectRepos`
  - disk mount points
  - local health URLs
- Do not include `.env`, SSH, TLS cert, database dump, backup, save archive, or broad sensitive directory paths.
- Set `GAMEOPS_OPERATOR_CONFIG_PATH=/srv/gameops-bridge/config/operator.local.json`.
- Set `GAMEOPS_OPERATOR_KEY` to a long random server-only value.
- Keep `GAMEOPS_OPERATOR_KEY` out of browser code, Vite env vars, localStorage, and sessionStorage.
- Keep runtime state outside the repo. Use `GAMEOPS_DATA_DIR=/srv/gameops-bridge/data` or set `GAMEOPS_OPERATOR_TIMELINE_PATH=/srv/gameops-bridge/data/operator.timeline.json`.

## Deploy

- Pull the latest GitHub branch on the VPS.
- Install dependencies if `package-lock.json` changed.
- Build or typecheck according to the existing deployment flow.
- Restart only through the existing manual production process. The AI Operator does not perform restarts.
- Confirm `git status --short` is clean after generated files and runtime JSON have been moved out of the checkout.

## Live Read-Only Verification

Admin context endpoint:

```sh
curl -sS \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  http://127.0.0.1:3001/api/operator/context
```

Admin brief endpoint:

```sh
curl -sS \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  http://127.0.0.1:3001/api/operator/brief
```

Dashboard summarized endpoint:

```sh
curl -sS \
  -H "Origin: https://servers.cdawgbot.xyz" \
  http://127.0.0.1:3001/api/dashboard/operator/brief
```

Unauthorized admin check:

```sh
curl -i http://127.0.0.1:3001/api/operator/context
```

Expected result: `401 Unauthorized` when `GAMEOPS_OPERATOR_KEY` is configured.

## Collector Signals To Confirm

- `pm2.status` is `available` when PM2 is installed and visible to the API user.
- `pm2.processes` lists expected GameOps services.
- `disks` includes configured mount checks with `usedPercent`.
- `repos` includes configured repositories and correct dirty/clean state.
- `logs` includes configured PM2 log sources with redacted recent lines.
- `healthChecks` includes local API/dashboard/Caddy checks.
- `collectionWarnings` only includes known intentionally missing optional sources.

## Failure Handling

Unavailable collectors should not break the endpoint. They should return `unavailable`, `missing`, `unreadable`, `unknown`, or a collection warning, and the API should emit sanitized structured warnings in server logs.

Do not use the AI Operator output as approval for automatic repairs. It is read-only situational awareness only.
