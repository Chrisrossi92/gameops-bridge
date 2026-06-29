# AI Operator VPS Deployment

The AI Operator endpoints are read-only. They collect server context for review and do not expose restart, deploy, update, shell, or write actions.

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

When `GAMEOPS_OPERATOR_KEY` is set, requests must include:

```text
x-gameops-operator-key: replace-with-a-long-random-value
```

In production, the operator endpoints fail closed if `GAMEOPS_OPERATOR_KEY` is missing. In local development, the endpoints are allowed without the header only when the key is not configured.

## 4. Test with curl

Brief endpoint:

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

## Security Notes

- Keep the operator API behind private networking, a VPN, or trusted ingress when possible.
- Treat `/api/operator/context` as sensitive operational metadata even though log lines are redacted.
- Review configured log paths before enabling the dashboard panel in production.
- Redaction is a safety layer, not permission to point the collector at secret-bearing files.
