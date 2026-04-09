# Palworld Save Snapshot Prototype

This workflow is read-only against the live Palworld save directory. It stages a timestamped copy for later parsing.

## Expected Live Save Paths

GameOps Bridge already has a Palworld `savePath` concept. The setup wizard defaults it to:

- `./Pal/Saved`

On a typical VPS-hosted dedicated server, the practical live save roots are usually one of:

- `/home/steam/Steam/steamapps/common/PalServer/Pal/Saved`
- `/opt/palworld/Pal/Saved`
- `/srv/palworld/Pal/Saved`
- a custom path exposed through your service manager or container bind mount

Within the live save root, the parser-relevant content is expected under:

- `<live-save-root>/SaveGames/0/<world-id>/Level.sav`
- `<live-save-root>/SaveGames/0/<world-id>/LevelMeta.sav`
- `<live-save-root>/SaveGames/0/<world-id>/Players/*.sav`
- `<live-save-root>/SaveGames/0/<world-id>/WorldOption.sav` when present

## Staging Paths

Recommended staging roots:

- `/var/backups/gameops/palworld-save-staging`
- `/srv/gameops/staging/palworld`
- `/tmp/gameops/palworld-save-staging` for short-lived prototypes only

The snapshot script creates:

- `<staging-root>/<source-dir-name>-<UTC timestamp>/`
- `<staging-root>/latest` symlink pointing to the newest staged copy

## Safe Extraction Workflow

1. Identify the live Palworld save root on the VPS.
2. Run the snapshot script against that live root.
3. Let the script copy the live directory into a timestamped staging directory.
4. Parse only the staged copy, never the live source.
5. If you later automate this, schedule the copy job first and the parser second.

Example:

```bash
./scripts/palworld-save-snapshot.sh \
  --source /home/steam/Steam/steamapps/common/PalServer/Pal/Saved \
  --staging-root /var/backups/gameops/palworld-save-staging
```

Environment-variable form:

```bash
export PALWORLD_SAVE_PATH=/home/steam/Steam/steamapps/common/PalServer/Pal/Saved
export PALWORLD_STAGING_ROOT=/var/backups/gameops/palworld-save-staging
./scripts/palworld-save-snapshot.sh
```

## Why This Is Safe

- The source tree is only read.
- All writes occur under the staging root.
- File timestamps and metadata are preserved by `rsync -a` or `cp -a`.
- The script does not inspect or mutate save contents.

## Next Parser Step

The next step should consume the staged copy, not the live path. The parser input should be:

- `<staging-root>/latest/SaveGames/0/<world-id>/Level.sav`
- `<staging-root>/latest/SaveGames/0/<world-id>/LevelMeta.sav`
- `<staging-root>/latest/SaveGames/0/<world-id>/Players/*.sav`
- `<staging-root>/latest/SaveGames/0/<world-id>/WorldOption.sav` if present

Recommended parser shape for the next phase:

1. Read staged `.sav` files only.
2. Convert them into normalized JSON artifacts in a separate output directory.
3. Keep GameOps Bridge consuming those artifacts rather than raw live save files.

## Parser Stub Prototype

A read-only parser stub is available at:

- `scripts/palworld-save-parse-stub.ts`

Example:

```bash
npm exec tsx scripts/palworld-save-parse-stub.ts \
  --snapshot-path /var/backups/gameops/palworld-save-staging/latest \
  --output-root /var/backups/gameops/palworld-save-artifacts
```

It validates the expected staged layout and emits:

- `snapshot-manifest.json`
- `world-summary.json`
- `players-summary.json`

The stub currently records only:

- detected world id
- file paths
- file sizes
- modified timestamps
- player save count
- parse status placeholders

It does not parse binary save contents yet.

## Optional First Parse Pass

The parser stub can optionally attempt a lightweight first parse pass if you provide an external Palworld save converter script.

Supported configuration:

- `--converter-script /path/to/convert.py`
- `--python-bin python3`

Environment-variable form:

- `PALWORLD_SAVE_CONVERT_PY`
- `PALWORLD_SAVE_PYTHON_BIN`

This is intended for `palworld-save-tools` style conversion workflows where a staged `.sav` file is converted to JSON first. The GameOps stub then reads the converted JSON and extracts only low-risk metadata hints.

If no converter is configured, the stub still runs and emits artifact files with placeholder parse status.

## Identity Reconciliation Step

The next artifact-only step is save-to-telemetry identity reconciliation:

- `scripts/palworld-identity-reconcile.ts`

Example:

```bash
npm exec tsx scripts/palworld-identity-reconcile.ts \
  --players-summary /var/backups/gameops/palworld-save-artifacts/latest/players-summary.json \
  --telemetry /path/to/palworld-telemetry.json \
  --output /var/backups/gameops/palworld-save-artifacts/latest/identity-links.json
```

This step is read-only against inputs and emits candidate identity links only. It does not mutate telemetry or save artifacts.
