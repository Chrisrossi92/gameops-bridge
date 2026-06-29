import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDiskUsage, collectGitStatuses, collectPm2Status, type OperatorCommandRunner } from './operator-collector.js';

test('collects PM2 process status from mocked jlist output', async () => {
  const runCommand: OperatorCommandRunner = async (command, args) => {
    assert.equal(command, 'pm2');
    assert.deepEqual(args, ['jlist']);

    return {
      ok: true,
      stdout: JSON.stringify([
        {
          name: 'gameops-api',
          pid: 123,
          pm2_env: {
            status: 'online',
            restart_time: 2,
            pm_uptime: Date.now() - 10_000
          },
          monit: {
            memory: 51_200_000,
            cpu: 3.5
          }
        }
      ]),
      stderr: '',
      exitCode: 0
    };
  };

  const status = await collectPm2Status(runCommand);

  assert.equal(status.status, 'available');
  assert.equal(status.processCount, 1);
  assert.equal(status.processes[0]?.name, 'gameops-api');
  assert.equal(status.processes[0]?.status, 'online');
  assert.equal(status.processes[0]?.restarts, 2);
  assert.equal(status.processes[0]?.memoryBytes, 51_200_000);
});

test('reports PM2 unavailable without throwing', async () => {
  const runCommand: OperatorCommandRunner = async () => ({
    ok: false,
    stdout: '',
    stderr: 'pm2: command not found',
    exitCode: null
  });

  const status = await collectPm2Status(runCommand);

  assert.equal(status.status, 'unavailable');
  assert.equal(status.processCount, 0);
  assert.match(status.message ?? '', /pm2/i);
});

test('collects disk usage from mocked df output', async () => {
  const runCommand: OperatorCommandRunner = async (command, args) => {
    assert.equal(command, 'df');
    assert.deepEqual(args, ['-Pk', '/srv/gameops']);

    return {
      ok: true,
      stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 1000 250 750 25% /srv/gameops\n',
      stderr: '',
      exitCode: 0
    };
  };

  const disks = await collectDiskUsage([{ label: 'gameops', path: '/srv/gameops' }], runCommand);

  assert.equal(disks[0]?.status, 'available');
  assert.equal(disks[0]?.usedPercent, 25);
  assert.equal(disks[0]?.sizeBytes, 1_024_000);
});

test('collects git branch and dirty status from mocked output', async () => {
  const runCommand: OperatorCommandRunner = async (command, args) => {
    assert.equal(command, 'git');
    assert.deepEqual(args, ['-C', '/srv/gameops', 'status', '--short', '--branch']);

    return {
      ok: true,
      stdout: '## main...origin/main [ahead 1, behind 2]\n M apps/api/src/index.ts\n?? config/operator.local.json\n',
      stderr: '',
      exitCode: 0
    };
  };

  const repos = await collectGitStatuses([{ label: 'gameops', path: '/srv/gameops' }], runCommand);

  assert.equal(repos[0]?.status, 'available');
  assert.equal(repos[0]?.branch, 'main...origin/main');
  assert.equal(repos[0]?.isDirty, true);
  assert.equal(repos[0]?.ahead, 1);
  assert.equal(repos[0]?.behind, 2);
  assert.equal(repos[0]?.changes.length, 2);
});
