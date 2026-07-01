#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-/root/gameops-bridge}"
config_path="${2:-$repo_root/config/gameops.config.json}"
output_dir="${3:-$repo_root/deploy/systemd/generated}"
template_path="$repo_root/deploy/systemd/templates/gameops-connector.service.template"

if [[ ! -f "$config_path" ]]; then
  echo "Config not found: $config_path" >&2
  exit 1
fi

if [[ ! -f "$template_path" ]]; then
  echo "Template not found: $template_path" >&2
  exit 1
fi

mkdir -p "$output_dir"

node --input-type=module - "$config_path" <<'NODE' | while IFS= read -r server_id; do
import { readFileSync } from 'node:fs';

const configPath = process.argv[2];
const config = JSON.parse(readFileSync(configPath, 'utf8'));

for (const server of config.servers ?? []) {
  if (server?.enabled === false) {
    continue;
  }

  if (typeof server?.id === 'string' && server.id.trim()) {
    console.log(server.id.trim());
  }
}
NODE
  unit_suffix="$(printf '%s' "$server_id" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  unit_suffix="${unit_suffix:-server}"
  output_path="$output_dir/gameops-connector-$unit_suffix.service"

  sed \
    -e "s#__REPO_ROOT__#$repo_root#g" \
    -e "s#__CONFIG_PATH__#$config_path#g" \
    -e "s#__SERVER_ID__#$server_id#g" \
    "$template_path" > "$output_path"

  echo "Rendered $output_path"
done

echo
echo "Review generated units, then install with:"
echo "  sudo cp $output_dir/gameops-connector-*.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
