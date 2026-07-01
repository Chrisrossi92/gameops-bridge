#!/usr/bin/env node
import { previewPlayerActivityImport } from '../apps/api/src/services/player-activity-import-preview.js';

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

const serverId = getArgValue('--server-id');
const result = previewPlayerActivityImport({
  ...(serverId ? { serverId } : {})
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
