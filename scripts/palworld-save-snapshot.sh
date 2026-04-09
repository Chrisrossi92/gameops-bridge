#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  palworld-save-snapshot.sh --source /path/to/Pal/Saved --staging-root /path/to/staging

Environment alternatives:
  PALWORLD_SAVE_PATH
  PALWORLD_STAGING_ROOT

Behavior:
  - Copies the live Palworld save directory into a timestamped staging folder
  - Preserves timestamps and file metadata
  - Never writes to or parses the source directory
EOF
}

SOURCE_PATH="${PALWORLD_SAVE_PATH:-}"
STAGING_ROOT="${PALWORLD_STAGING_ROOT:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_PATH="${2:-}"
      shift 2
      ;;
    --staging-root)
      STAGING_ROOT="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_PATH" || -z "$STAGING_ROOT" ]]; then
  echo "Both source and staging root are required." >&2
  usage >&2
  exit 1
fi

if [[ ! -d "$SOURCE_PATH" ]]; then
  echo "Source path does not exist or is not a directory: $SOURCE_PATH" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE_BASENAME="$(basename "$SOURCE_PATH")"
SNAPSHOT_DIR="${STAGING_ROOT%/}/${SOURCE_BASENAME}-${TIMESTAMP}"
LATEST_LINK="${STAGING_ROOT%/}/latest"

mkdir -p "$SNAPSHOT_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a "$SOURCE_PATH"/ "$SNAPSHOT_DIR"/
else
  cp -a "$SOURCE_PATH"/. "$SNAPSHOT_DIR"/
fi

ln -sfn "$SNAPSHOT_DIR" "$LATEST_LINK"

echo "Palworld save snapshot created"
echo "  source:  $SOURCE_PATH"
echo "  staging: $SNAPSHOT_DIR"
echo "  latest:  $LATEST_LINK"
