import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardOperatorBrief, buildOperatorBrief, collectDiskUsage, collectGitStatuses, collectOperatorContext, collectPm2Status, type OperatorCommandRunner } from './operator-collector.js';

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
  const repoPath = process.cwd();
  const runCommand: OperatorCommandRunner = async (command, args) => {
    assert.equal(command, 'git');
    if (args.includes('log')) {
      assert.deepEqual(args, ['-C', repoPath, 'log', '-1', '--format=%H%x09%cI%x09%s']);
      return {
        ok: true,
        stdout: 'abcdef1234567890\t2026-06-29T12:00:00.000Z\tHarden operator repo signal\n',
        stderr: '',
        exitCode: 0
      };
    }

    assert.deepEqual(args, ['-C', repoPath, 'status', '--short', '--branch']);

    return {
      ok: true,
      stdout: '## main...origin/main [ahead 1, behind 2]\n M apps/api/src/index.ts\n?? config/operator.local.json\n',
      stderr: '',
      exitCode: 0
    };
  };

  const repos = await collectGitStatuses([{ label: 'gameops', path: repoPath }], runCommand);

  assert.equal(repos[0]?.status, 'available');
  assert.equal(repos[0]?.branch, 'main');
  assert.equal(repos[0]?.isDirty, true);
  assert.equal(repos[0]?.ahead, 1);
  assert.equal(repos[0]?.behind, 2);
  assert.equal(repos[0]?.changes.length, 2);
  assert.equal(repos[0]?.upstream, 'origin/main');
  assert.equal(repos[0]?.modifiedCount, 1);
  assert.equal(repos[0]?.stagedCount, 0);
  assert.equal(repos[0]?.untrackedCount, 1);
  assert.deepEqual(repos[0]?.recommendations, ['local-changes-review', 'untracked-files-review', 'behind-upstream', 'ahead-of-upstream']);
  assert.equal(repos[0]?.lastCommit?.hash, 'abcdef123456');
});

test('caps changed file paths and never reads file contents', async () => {
  const repoPath = process.cwd();
  let logCalled = false;
  const statusLines = Array.from({ length: 12 }, (_, index) => ` M src/file-${index + 1}.ts`).join('\n');
  const repos = await collectGitStatuses([{ label: 'gameops', path: repoPath }], async (_command, args) => {
    if (args.includes('log')) {
      logCalled = true;
      return {
        ok: true,
        stdout: '1234567890abcdef\t2026-06-29T12:00:00.000Z\tCommit message with API_KEY=secret-value\n',
        stderr: '',
        exitCode: 0
      };
    }

    return {
      ok: true,
      stdout: `## main\n${statusLines}\n`,
      stderr: '',
      exitCode: 0
    };
  });

  assert.equal(logCalled, true);
  assert.equal(repos[0]?.changedFilePaths.length, 10);
  assert.equal(repos[0]?.modifiedCount, 12);
  assert.equal(repos[0]?.lastCommit?.message.includes('secret-value'), false);
  assert(!repos[0]?.changedFilePaths.some((path) => path.includes('file contents')));
});

test('reports missing repo paths as unavailable without running git', async () => {
  let commandWasCalled = false;
  const repos = await collectGitStatuses(
    [{ label: 'missing-repo', path: '/definitely/missing/gameops/repo' }],
    async () => {
      commandWasCalled = true;
      return {
        ok: true,
        stdout: '',
        stderr: '',
        exitCode: 0
      };
    }
  );

  assert.equal(commandWasCalled, false);
  assert.equal(repos[0]?.status, 'unavailable');
  assert.equal(repos[0]?.message, 'Configured repo path is not present.');
});

test('collects context gracefully when probes are unavailable and logs sanitized warnings', async () => {
  const warningPayloads: Record<string, unknown>[] = [];
  const runCommand: OperatorCommandRunner = async (command) => {
    if (command === 'pm2') {
      return {
        ok: false,
        stdout: '',
        stderr: 'DISCORD_TOKEN=super-secret-token-value',
        exitCode: null
      };
    }

    if (command === 'df') {
      return {
        ok: false,
        stdout: '',
        stderr: 'df failed',
        exitCode: 1
      };
    }

    return {
      ok: false,
      stdout: '',
      stderr: 'fatal: not a git repository',
      exitCode: 128
    };
  };

  const context = await collectOperatorContext({
    config: {
      diskPaths: [{ label: 'missing-disk', path: '/missing' }],
      healthChecks: [],
      logPaths: [{ label: 'missing-log', path: '/missing/operator.log' }],
      projectRepos: [{ label: 'missing-repo', path: '/missing/repo' }]
    },
    logger: {
      warn: (payload) => {
        warningPayloads.push(payload);
      }
    },
    runCommand
  });

  assert.equal(context.pm2.status, 'unavailable');
  assert.equal(context.disks[0]?.status, 'unavailable');
  assert.equal(context.repos[0]?.status, 'unavailable');
  assert.equal(context.logs[0]?.status, 'missing');
  assert(warningPayloads.length >= 4);
  assert(!JSON.stringify(warningPayloads).includes('super-secret-token-value'));
});

test('logs invalid config warnings without exposing secret-like content', async () => {
  const warningPayloads: Record<string, unknown>[] = [];
  await collectOperatorContext({
    config: {
      diskPaths: [],
      healthChecks: [],
      logPaths: [],
      projectRepos: [],
      configWarnings: ['Operator config field "repoPaths" ignored TOKEN=super-secret-token-value']
    },
    logger: {
      warn: (payload) => {
        warningPayloads.push(payload);
      }
    },
    runCommand: async () => ({
      ok: false,
      stdout: '',
      stderr: '',
      exitCode: 1
    })
  });

  const logged = JSON.stringify(warningPayloads);
  assert(logged.includes('repoPaths'));
  assert(!logged.includes('super-secret-token-value'));
});

test('operator brief summarizes health, PM2, disk, git, warnings, and next action', async () => {
  const context = await collectOperatorContext({
    config: {
      diskPaths: [{ label: 'app-volume', path: '/srv' }],
      healthChecks: [],
      logPaths: [],
      projectRepos: [{ label: 'gameops', path: process.cwd() }]
    },
    runCommand: async (command, args) => {
      if (command === 'pm2') {
        return {
          ok: true,
          stdout: JSON.stringify([
            {
              name: 'gameops-api',
              pid: 123,
              pm2_env: {
                status: 'stopped',
                restart_time: 1,
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
      }

      if (command === 'df') {
        return {
          ok: true,
          stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 1000 930 70 93% /srv\n',
          stderr: '',
          exitCode: 0
        };
      }

      if (command === 'git' && args.includes('log')) {
        return {
          ok: true,
          stdout: 'abcdef1234567890\t2026-06-29T12:00:00.000Z\tLast repo commit\n',
          stderr: '',
          exitCode: 0
        };
      }

      return {
        ok: true,
        stdout: '## main...origin/main [behind 1]\n M apps/api/src/index.ts\n?? tmp/debug.txt\n',
        stderr: '',
        exitCode: 0
      };
    }
  });

  const brief = buildOperatorBrief(context);

  assert.equal(brief.health, 'warning');
  assert.match(brief.summary, /PM2 available/);
  assert(brief.risks.some((risk) => risk.includes('gameops-api is stopped')));
  assert(brief.risks.some((risk) => risk.includes('app-volume disk usage is high')));
  assert(brief.recentEvents.some((event) => event.includes('Git: gameops is dirty')));
  assert(brief.recommendations.some((recommendation) => recommendation.includes('PM2 process status')));
  assert(brief.recommendations.some((recommendation) => recommendation.includes('Pull only after local repo changes are reviewed')));
  assert(brief.recommendations.some((recommendation) => recommendation.includes('Classify untracked files before cleanup')));
});

test('dashboard brief includes concise repo state summary', async () => {
  const context = await collectOperatorContext({
    config: {
      diskPaths: [],
      healthChecks: [],
      logPaths: [],
      projectRepos: [{ label: 'gameops', path: process.cwd() }]
    },
    runCommand: async (command, args) => {
      if (command === 'pm2') {
        return {
          ok: false,
          stdout: '',
          stderr: '',
          exitCode: 1
        };
      }

      if (args.includes('log')) {
        return {
          ok: true,
          stdout: 'abcdef1234567890\t2026-06-29T12:00:00.000Z\tClean repo commit\n',
          stderr: '',
          exitCode: 0
        };
      }

      return {
        ok: true,
        stdout: '## main...origin/main\n',
        stderr: '',
        exitCode: 0
      };
    }
  });

  const brief = buildDashboardOperatorBrief(context);

  assert(brief.recentEvents.some((event) => event === 'Git checks: 1 repo configured.'));
  assert(brief.recentEvents.some((event) => event === 'gameops is clean on main -> origin/main, last abcdef123456.'));
});
