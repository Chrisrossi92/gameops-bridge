# Connector Deployment Unification

GameOps connector services should run from one checkout and one generated unit template. The current VPS target is:

```sh
/root/gameops-bridge
```

## Current Inconsistency

The checked-in static systemd units under `deploy/systemd/` still use the older path:

```ini
WorkingDirectory=/opt/gameops-bridge
Environment=GAMEOPS_CONFIG_PATH=/opt/gameops-bridge/config/gameops.config.json
```

That explains why `gameops-connector-palworld-fantasy-1.service` can still reference `/opt/gameops-bridge`.

The working Valheim service on the VPS is not evidence that the static unit files are correct. It likely works because the installed unit or a systemd drop-in was updated on the VPS to point at `/root/gameops-bridge`, while the Palworld unit was left on the legacy path.

## Standard Connector Unit Shape

All connector units should have the same runtime layout:

```ini
WorkingDirectory=/root/gameops-bridge
Environment=NODE_ENV=production
Environment=GAMEOPS_CONFIG_PATH=/root/gameops-bridge/config/gameops.config.json
Environment=CONNECTOR_SERVER_ID=<server-id>
Environment=API_BASE_URL=http://127.0.0.1:3001
ExecStart=/usr/bin/env npm --workspace apps/connector run dev
```

The only expected difference between connector units is:

```ini
Description=GameOps Bridge Connector (<server-id>)
Environment=CONNECTOR_SERVER_ID=<server-id>
```

## Template And Renderer

The connector service template lives at:

```sh
deploy/systemd/templates/gameops-connector.service.template
```

Render connector units from the active config:

```sh
bash scripts/render-connector-units.sh \
  /root/gameops-bridge \
  /root/gameops-bridge/config/gameops.config.json \
  /root/gameops-bridge/deploy/systemd/generated
```

This creates:

```sh
deploy/systemd/generated/gameops-connector-<server-id>.service
```

Review generated units before installing them.

## Migration Plan

1. Do not stop Valheim or Palworld game server services.
2. Inspect current connector units:

   ```sh
   systemctl cat gameops-connector.service
   systemctl cat gameops-connector-palworld-fantasy-1.service
   systemctl show gameops-connector.service --property=WorkingDirectory --property=Environment
   systemctl show gameops-connector-palworld-fantasy-1.service --property=WorkingDirectory --property=Environment
   ```

3. Render fresh connector units from `/root/gameops-bridge`.
4. Diff generated units against installed units.
5. Install only connector units, not game server units.
6. Reload systemd.
7. Restart one connector at a time.
8. Verify API operational status after each restart.

## Rollout Steps

```sh
cd /root/gameops-bridge

bash scripts/render-connector-units.sh \
  /root/gameops-bridge \
  /root/gameops-bridge/config/gameops.config.json \
  /root/gameops-bridge/deploy/systemd/generated

diff -u /etc/systemd/system/gameops-connector-palworld-fantasy-1.service \
  /root/gameops-bridge/deploy/systemd/generated/gameops-connector-palworld-fantasy-1.service || true

sudo cp /root/gameops-bridge/deploy/systemd/generated/gameops-connector-palworld-fantasy-1.service \
  /etc/systemd/system/gameops-connector-palworld-fantasy-1.service

sudo systemctl daemon-reload
sudo systemctl restart gameops-connector-palworld-fantasy-1.service

systemctl is-active gameops-connector-palworld-fantasy-1.service
curl -fsS http://127.0.0.1:3001/servers/palworld-fantasy-1/operational-status
```

If the Valheim connector also needs unification, repeat the same generated-unit install for its connector service only.

## Rollback Steps

Before replacing an installed unit, save it:

```sh
sudo cp /etc/systemd/system/gameops-connector-palworld-fantasy-1.service \
  /etc/systemd/system/gameops-connector-palworld-fantasy-1.service.bak.$(date +%Y%m%d%H%M%S)
```

Rollback:

```sh
sudo cp /etc/systemd/system/gameops-connector-palworld-fantasy-1.service.bak.<timestamp> \
  /etc/systemd/system/gameops-connector-palworld-fantasy-1.service

sudo systemctl daemon-reload
sudo systemctl restart gameops-connector-palworld-fantasy-1.service
systemctl is-active gameops-connector-palworld-fantasy-1.service
```

Rollback should affect only the GameOps connector process. Do not restart Valheim or Palworld server services as part of this migration.

## Validation For Palworld Collector Shadow

Once the Palworld connector uses `/root/gameops-bridge`, enable collector validation through the connector environment or a systemd drop-in:

```ini
Environment=GAMEOPS_COLLECTORS_ENABLED=true
```

Then restart only:

```sh
sudo systemctl restart gameops-connector-palworld-fantasy-1.service
```

Expected heartbeat collector health includes `palworld:palworld-fantasy-1:rest` with `snapshot.snapshotSize`, `joinedCount`, `leftCount`, and `lastSuccessfulPollAt`.
