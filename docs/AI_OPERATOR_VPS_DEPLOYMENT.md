# AI Operator VPS Deployment

The AI Operator endpoints are read-only. They collect server context for review and do not expose restart, deploy, update, shell, or write actions.

There are two endpoint groups:

- Admin endpoints: `/api/operator/context` and `/api/operator/brief`
- Dashboard endpoint: `/api/dashboard/operator/brief`

The admin endpoints are protected by `GAMEOPS_OPERATOR_KEY`. The dashboard endpoint returns only the summarized brief and must not return raw context or log lines.

## 1. Create the VPS config

Start from the example:

```sh
cp config/operator.vps.example.json config/operator.local.json
```

Edit `config/operator.local.json` on the VPS so it contains only paths that are safe to read and summarize:

- PM2 stdout/error logs for GameOps services
- project repository directories for `git status`
- disk mount paths such as `/`, `/srv`, or a game data volume
- local health endpoints such as `http://127.0.0.1:3001/health`

Do not include `.env` files, SSH directories or keys, TLS certificates, database dumps, save backups containing private data, or broad directories such as `/home`, `/etc`, `/var/lib`, or `/`.

## 2. Set the config path

Set `GAMEOPS_OPERATOR_CONFIG_PATH` for the API process:

```sh
export GAMEOPS_OPERATOR_CONFIG_PATH=/srv/gameops-bridge/config/operator.local.json
```

For PM2, add it to the API app environment in your ecosystem file or PM2 process configuration.

## 3. Set the operator API key

Set a strong random key for production:

```sh
export GAMEOPS_OPERATOR_KEY='replace-with-a-long-random-value'
```

When `GAMEOPS_OPERATOR_KEY` is set, admin requests must include:

```text
x-gameops-operator-key: replace-with-a-long-random-value
```

In production, the admin operator endpoints fail closed if `GAMEOPS_OPERATOR_KEY` is missing. In local development, the admin endpoints are allowed without the header only when the key is not configured.

Do not expose `GAMEOPS_OPERATOR_KEY` to browser JavaScript. Do not add it to Vite variables, localStorage, sessionStorage, dashboard code, or any client-delivered configuration. It belongs only in the API process environment and in trusted admin curl sessions.

## 4. Test with curl

Admin brief endpoint:

```sh
curl -sS \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  http://127.0.0.1:3001/api/operator/brief
```

Full context endpoint:

```sh
curl -sS \
  -H "x-gameops-operator-key: $GAMEOPS_OPERATOR_KEY" \
  http://127.0.0.1:3001/api/operator/context
```

Unauthorized check:

```sh
curl -i http://127.0.0.1:3001/api/operator/brief
```

Expected result with `GAMEOPS_OPERATOR_KEY` configured: `401 Unauthorized`.

Dashboard-safe summarized brief:

```sh
curl -sS \
  -H "Origin: https://servers.cdawgbot.xyz" \
  http://127.0.0.1:3001/api/dashboard/operator/brief
```

The dashboard endpoint does not use `x-gameops-operator-key` and does not return raw logs. In production it is intended for the configured dashboard origin, while direct admin access should use the protected admin endpoints above.

For production rollout and live verification, use [AI_OPERATOR_DEPLOYMENT_CHECKLIST.md](./AI_OPERATOR_DEPLOYMENT_CHECKLIST.md).

## Security Notes

- Keep the operator API behind private networking, a VPN, or trusted ingress when possible.
- Treat `/api/operator/context` as sensitive operational metadata even though log lines are redacted.
- Treat `/api/operator/brief` as an admin endpoint because it may include sanitized operational event text.
- Use `/api/dashboard/operator/brief` for the browser dashboard. It returns a stricter summarized brief with no raw log lines.
- Keep `GAMEOPS_OPERATOR_KEY` server-only.
- Review configured log paths before enabling the dashboard panel in production.
- Redaction is a safety layer, not permission to point the collector at secret-bearing files.
