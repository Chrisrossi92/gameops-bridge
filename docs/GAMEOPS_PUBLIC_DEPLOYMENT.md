# GameOps Bridge Public Dashboard Deployment

This guide makes the dashboard and API reachable through:

- `https://servers.cdawgbot.xyz` for the dashboard
- `https://api.servers.cdawgbot.xyz` for the API

The public deployment should be read-oriented until authentication exists. Do not expose secrets, raw config files, Palworld REST passwords, Discord tokens, or unauthenticated write/apply actions.

## Current App Ports And Commands

| App | Default port | Local command | Production notes |
| --- | ---: | --- | --- |
| API | `3001` | `npm --workspace apps/api run dev` | Bind locally behind the proxy when possible. |
| Dashboard | `4173` for preview | `npm --workspace apps/web run preview -- --host 127.0.0.1 --port 4173` | Requires `npm --workspace apps/web run build` first. |
| Connector | none | `npm --workspace apps/connector run dev` | Runs as a background poller/log tailer. Keep it private. |
| Bot | none | `npm --workspace apps/bot run dev` | Runs as a Discord client. Keep token in environment/secrets only. |

## DNS Records

Create these DNS records for the VPS public IP:

```text
servers.cdawgbot.xyz      A      <VPS_IPV4>
api.servers.cdawgbot.xyz  A      <VPS_IPV4>
```

If you use IPv6, also add matching `AAAA` records.

## Production Environment

API:

```bash
export NODE_ENV=production
export PORT=3001
export API_HOST=127.0.0.1
export GAMEOPS_CONFIG_PATH=/opt/gameops-bridge/config/gameops.config.json
export API_CORS_ORIGIN=https://servers.cdawgbot.xyz
```

Dashboard build:

```bash
cd /opt/gameops-bridge
VITE_API_BASE_URL=https://api.servers.cdawgbot.xyz npm --workspace apps/web run build
```

Local development still works without these production values:

- dashboard falls back to `http://localhost:3001`
- API CORS is open in non-production mode

## Install And Build On VPS

```bash
cd /opt/gameops-bridge
npm install
npm run typecheck --workspaces
VITE_API_BASE_URL=https://api.servers.cdawgbot.xyz npm --workspace apps/web run build
```

Keep runtime config and secrets local to the VPS:

```bash
cp config/gameops.secrets.example.env /etc/gameops-bridge.env
chmod 600 /etc/gameops-bridge.env
```

Do not commit `config/gameops.config.json`, `config/bot.local.json`, `.env`, or real secrets.

## Caddy Example

Recommended public posture before auth: expose read requests through the public API host and keep mutations local/private. The connector and bot should call `http://127.0.0.1:3001`, not the public API hostname.

```caddyfile
servers.cdawgbot.xyz {
  encode zstd gzip
  reverse_proxy 127.0.0.1:4173
}

api.servers.cdawgbot.xyz {
  encode zstd gzip

  @unsafe_methods {
    not method GET HEAD OPTIONS
  }
  respond @unsafe_methods "Public GameOps API is read-only until auth is implemented." 403

  reverse_proxy 127.0.0.1:3001
}
```

Caddy will request and renew HTTPS certificates automatically when DNS points at the VPS and ports `80` and `443` are reachable.

## Nginx Example

Use Caddy if available. If using Nginx, pair this with Certbot or another TLS manager.

```nginx
server {
  listen 80;
  server_name servers.cdawgbot.xyz;

  location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.servers.cdawgbot.xyz;

  if ($request_method !~ ^(GET|HEAD|OPTIONS)$) {
    return 403;
  }

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Systemd Services

Existing generated units cover:

- `gameops-api.service`
- `gameops-bot.service`
- `gameops-connector-<server-id>.service`

The dashboard also needs its own service because it serves the built web app:

- `deploy/systemd/gameops-dashboard.service`

Example install:

```bash
sudo cp deploy/systemd/gameops-api.service /etc/systemd/system/gameops-api.service
sudo cp deploy/systemd/gameops-dashboard.service /etc/systemd/system/gameops-dashboard.service
sudo cp deploy/systemd/gameops-bot.service /etc/systemd/system/gameops-bot.service

bash scripts/render-connector-units.sh \
  /root/gameops-bridge \
  /root/gameops-bridge/config/gameops.config.json \
  /root/gameops-bridge/deploy/systemd/generated

sudo cp deploy/systemd/generated/gameops-connector-*.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now gameops-api.service
sudo systemctl enable --now gameops-dashboard.service
sudo systemctl enable --now gameops-bot.service
sudo systemctl enable --now gameops-connector-palworld-fantasy-1.service
```

The static files under `deploy/systemd/gameops-connector-*.service` are legacy examples. For production, render connector units from `deploy/systemd/templates/gameops-connector.service.template` so every connector uses the same repo root and config path. See `docs/CONNECTOR_DEPLOYMENT_UNIFICATION.md`.

Check status:

```bash
sudo systemctl status gameops-api.service
sudo systemctl status gameops-dashboard.service
sudo journalctl -u gameops-api.service -n 100 --no-pager
sudo journalctl -u gameops-dashboard.service -n 100 --no-pager
```

## Verification

From the VPS:

```bash
curl -fsS http://127.0.0.1:3001/health
curl -I http://127.0.0.1:4173
```

From anywhere after DNS/TLS:

```bash
curl -fsS https://api.servers.cdawgbot.xyz/health
curl -I https://servers.cdawgbot.xyz
```

Verify CORS in production:

```bash
curl -I \
  -H 'Origin: https://servers.cdawgbot.xyz' \
  https://api.servers.cdawgbot.xyz/health

curl -I \
  -H 'Origin: https://not-allowed.example' \
  https://api.servers.cdawgbot.xyz/health
```

The allowed origin should receive `access-control-allow-origin: https://servers.cdawgbot.xyz`. The unrelated origin should not.

## Safety Notes

- Do not commit `config/gameops.config.json`, `config/bot.local.json`, real `.env` files, Discord tokens, Palworld REST credentials, or admin passwords.
- Keep connector and bot traffic on localhost or a private network.
- Public API proxy should reject non-GET methods until authentication and authorization exist.
- The dashboard currently has draft/edit/review controls that call mutation endpoints. Those actions should remain unavailable through the public proxy until auth exists.
- Read-only event draft previews, config audits, backup readiness, runtime audit, and manual plans do not mutate the server.
- Future settings write/apply actions require auth, backup creation, rollback validation, restart handling, and explicit owner confirmation before public exposure.
