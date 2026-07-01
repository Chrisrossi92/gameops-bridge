import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadOperatorConfig } from './operator-config.js';

function writeOperatorConfig(content: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), 'gameops-operator-config-'));
  const configPath = join(directory, 'operator.local.json');
  writeFileSync(configPath, JSON.stringify(content), 'utf8');
  return configPath;
}

test('loads repo paths from repoPaths alias with string and named object entries', () => {
  const configPath = writeOperatorConfig({
    repoPaths: [
      '/srv/gameops-bridge',
      {
        name: 'Palworld bot',
        path: '/srv/palworld-bot'
      }
    ]
  });

  const config = loadOperatorConfig({ GAMEOPS_OPERATOR_CONFIG_PATH: configPath });

  assert.deepEqual(config.projectRepos, [
    {
      label: 'gameops-bridge',
      path: '/srv/gameops-bridge'
    },
    {
      label: 'Palworld bot',
      path: '/srv/palworld-bot'
    }
  ]);
  assert(config.configWarnings?.some((warning) => warning.includes('"repoPaths" is supported as a repo-path alias')));
});

test('reports invalid repo config fields with useful warnings', () => {
  const configPath = writeOperatorConfig({
    repoPaths: {
      label: 'not an array',
      path: '/srv/gameops-bridge'
    },
    repositories: [
      {
        label: 'missing path'
      }
    ]
  });

  const config = loadOperatorConfig({ GAMEOPS_OPERATOR_CONFIG_PATH: configPath });

  assert.deepEqual(config.projectRepos, []);
  assert(config.configWarnings?.some((warning) => warning.includes('"repositories" entry 1 must include label and path')));
  assert(config.configWarnings?.some((warning) => warning.includes('"repoPaths" was ignored')));
});
