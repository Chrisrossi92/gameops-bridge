import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { cpus, freemem, loadavg, totalmem, uptime } from 'node:os';
import type {
  OperatorBrief,
  OperatorCommandProbeStatus,
  OperatorContext,
  OperatorDiskUsage,
  OperatorGitRepoStatus,
  OperatorHealthCheck,
  OperatorLogSource,
  OperatorPm2Status
} from '@gameops/shared';
import { loadOperatorConfig, type OperatorConfig, type OperatorPathConfig } from './operator-config.js';
import { redactLines, redactSecrets } from './operator-redaction.js';

const COMMAND_TIMEOUT_MS = 2_500;
const HEALTH_TIMEOUT_MS = 2_500;
const MAX_LOG_BYTES = 64 * 1024;
const MAX_LOG_LINES = 40;
const MAX_REPO_CHANGED_PATHS = 10;

export interface OperatorCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export type OperatorCommandRunner = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number }
) => Promise<OperatorCommandResult>;

export interface OperatorCollectorLogger {
  warn: (payload: Record<string, unknown>, message?: string) => void;
}

export const defaultOperatorCommandRunner: OperatorCommandRunner = (command, args, options = {}) => {
  return new Promise((resolve) => {
    execFile(command, args, {
      timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
      maxBuffer: 512 * 1024,
      shell: false
    }, (error, stdout, stderr) => {
      const errorWithCode = error as NodeJS.ErrnoException & { code?: string | number } | null;
      const exitCode = typeof errorWithCode?.code === 'number' ? errorWithCode.code : null;

      resolve({
        ok: !error,
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        exitCode
      });
    });
  });
};

function optionalMessage(value: string): { message?: string } {
  const cleaned = redactSecrets(value).trim();
  return cleaned ? { message: cleaned.slice(0, 240) } : {};
}

function logCollectorWarning(
  logger: OperatorCollectorLogger | undefined,
  collector: string,
  detail: string
): void {
  logger?.warn({
    collector,
    detail: redactSecrets(detail).slice(0, 240)
  }, 'AI Operator collector warning');
}

function parsePm2Status(stdout: string): OperatorPm2Status {
  const parsed = JSON.parse(stdout) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('PM2 returned an unexpected payload.');
  }

  const processes = parsed.flatMap((entry): OperatorPm2Status['processes'] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const monit = typeof record.monit === 'object' && record.monit !== null ? record.monit as Record<string, unknown> : {};
    const pm2Env = typeof record.pm2_env === 'object' && record.pm2_env !== null ? record.pm2_env as Record<string, unknown> : {};
    const name = typeof record.name === 'string' ? record.name : null;

    if (!name) {
      return [];
    }

    return [{
      name: redactSecrets(name),
      pid: typeof record.pid === 'number' ? record.pid : null,
      status: typeof pm2Env.status === 'string' ? pm2Env.status : 'unknown',
      restarts: typeof pm2Env.restart_time === 'number' ? Math.max(0, pm2Env.restart_time) : 0,
      uptimeMs: typeof pm2Env.pm_uptime === 'number' ? Math.max(0, Date.now() - pm2Env.pm_uptime) : null,
      memoryBytes: typeof monit.memory === 'number' ? Math.max(0, monit.memory) : null,
      cpuPercent: typeof monit.cpu === 'number' ? Math.max(0, monit.cpu) : null
    }];
  });

  return {
    status: 'available',
    processCount: processes.length,
    processes
  };
}

export async function collectPm2Status(runCommand: OperatorCommandRunner = defaultOperatorCommandRunner): Promise<OperatorPm2Status> {
  const result = await runCommand('pm2', ['jlist'], { timeoutMs: COMMAND_TIMEOUT_MS });

  if (!result.ok) {
    return {
      status: 'unavailable',
      processCount: 0,
      processes: [],
      ...optionalMessage(result.stderr || result.stdout || 'PM2 is not available.')
    };
  }

  try {
    return parsePm2Status(result.stdout);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to parse PM2 output.';
    return {
      status: 'error',
      processCount: 0,
      processes: [],
      message: redactSecrets(detail)
    };
  }
}

export function collectSystemStatus(): OperatorContext['system'] {
  let uptimeSeconds = 0;
  let systemLoadAverage: [number, number, number] = [0, 0, 0];
  let cpuCount = 1;
  let total = 0;
  let free = 0;

  try {
    uptimeSeconds = Math.floor(uptime());
  } catch {
    uptimeSeconds = 0;
  }

  try {
    systemLoadAverage = loadavg() as [number, number, number];
  } catch {
    systemLoadAverage = [0, 0, 0];
  }

  try {
    cpuCount = Math.max(1, cpus().length);
  } catch {
    cpuCount = 1;
  }

  try {
    total = totalmem();
    free = freemem();
  } catch {
    total = 0;
    free = 0;
  }

  const used = Math.max(0, total - free);

  return {
    uptimeSeconds,
    loadAverage: systemLoadAverage,
    cpuCount,
    memory: {
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usedPercent: total > 0 ? Math.round((used / total) * 10_000) / 100 : 0
    }
  };
}

function parseDfOutput(label: string, stdout: string): OperatorDiskUsage {
  const lines = stdout.trim().split(/\r?\n/);
  const values = lines[1]?.trim().split(/\s+/);

  if (!values || values.length < 5) {
    throw new Error('Disk probe returned an unexpected payload.');
  }

  const sizeBytes = Number(values[1]) * 1024;
  const usedBytes = Number(values[2]) * 1024;
  const availableBytes = Number(values[3]) * 1024;
  const usedPercent = Number(String(values[4]).replace('%', ''));

  return {
    label,
    status: 'available',
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    usedBytes: Number.isFinite(usedBytes) ? usedBytes : null,
    availableBytes: Number.isFinite(availableBytes) ? availableBytes : null,
    usedPercent: Number.isFinite(usedPercent) ? usedPercent : null
  };
}

export async function collectDiskUsage(
  diskPaths: OperatorPathConfig[],
  runCommand: OperatorCommandRunner = defaultOperatorCommandRunner
): Promise<OperatorDiskUsage[]> {
  const targets = diskPaths.length > 0 ? diskPaths : [{ label: 'workspace', path: process.cwd() }];

  return Promise.all(targets.map(async (target) => {
    const result = await runCommand('df', ['-Pk', target.path], { timeoutMs: COMMAND_TIMEOUT_MS });

    if (!result.ok) {
      return {
        label: target.label,
        status: 'unavailable' as OperatorCommandProbeStatus,
        sizeBytes: null,
        usedBytes: null,
        availableBytes: null,
        usedPercent: null,
        ...optionalMessage(result.stderr || result.stdout || 'Disk usage is unavailable.')
      };
    }

    try {
      return parseDfOutput(target.label, result.stdout);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to parse disk usage.';
      return {
        label: target.label,
        status: 'error',
        sizeBytes: null,
        usedBytes: null,
        availableBytes: null,
        usedPercent: null,
        message: redactSecrets(detail)
      };
    }
  }));
}

function tailTextFile(path: string): string[] {
  const stats = statSync(path);
  const start = Math.max(0, stats.size - MAX_LOG_BYTES);
  const raw = readFileSync(path).subarray(start).toString('utf8');
  return raw.split(/\r?\n/).filter(Boolean).slice(-MAX_LOG_LINES);
}

export function collectConfiguredLogs(logPaths: OperatorPathConfig[]): OperatorLogSource[] {
  return logPaths.map((source) => {
    try {
      if (!existsSync(source.path)) {
        return {
          label: source.label,
          status: 'missing',
          lines: [],
          message: `${basename(source.path)} is not present.`
        };
      }

      return {
        label: source.label,
        status: 'available',
        lines: redactLines(tailTextFile(source.path))
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to read configured log.';
      return {
        label: source.label,
        status: 'unreadable',
        lines: [],
        message: redactSecrets(detail)
      };
    }
  });
}

function parseGitBranchLine(branchLine: string | null): {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  detached: boolean;
} {
  if (!branchLine) {
    return {
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      detached: false
    };
  }

  const body = branchLine.replace(/^##\s*/, '').trim();
  const ahead = Number(body.match(/\bahead (\d+)/)?.[1] ?? 0);
  const behind = Number(body.match(/\bbehind (\d+)/)?.[1] ?? 0);
  const withoutTrackingSummary = body.replace(/\s*\[.*\]\s*$/, '').trim();
  const [branchRaw, upstreamRaw] = withoutTrackingSummary.split('...');
  const branch = branchRaw?.trim() || null;

  return {
    branch,
    upstream: upstreamRaw?.trim() || null,
    ahead,
    behind,
    detached: branch === 'HEAD (no branch)' || branch === 'HEAD'
  };
}

function parseChangedFilePath(statusLine: string): string | null {
  const rawPath = statusLine.slice(3).trim();

  if (!rawPath) {
    return null;
  }

  const renamePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath;
  return redactSecrets(renamePath?.replace(/^"|"$/g, '') ?? '').slice(0, 180);
}

function parseGitLastCommit(stdout: string): OperatorGitRepoStatus['lastCommit'] {
  const [hash, date, ...messageParts] = stdout.trim().split('\t');
  const message = messageParts.join('\t').trim();

  if (!hash || !date || !message) {
    return null;
  }

  return {
    hash: redactSecrets(hash).slice(0, 12),
    date: redactSecrets(date).slice(0, 40),
    message: redactSecrets(message).slice(0, 120)
  };
}

function getRepoRecommendations(input: {
  status: OperatorCommandProbeStatus;
  detached: boolean;
  ahead: number;
  behind: number;
  modifiedCount: number;
  stagedCount: number;
  untrackedCount: number;
}): OperatorGitRepoStatus['recommendations'] {
  if (input.status !== 'available') {
    return ['unavailable'];
  }

  const recommendations: OperatorGitRepoStatus['recommendations'] = [];

  if (input.modifiedCount > 0 || input.stagedCount > 0) {
    recommendations.push('local-changes-review');
  }

  if (input.untrackedCount > 0) {
    recommendations.push('untracked-files-review');
  }

  if (input.behind > 0) {
    recommendations.push('behind-upstream');
  }

  if (input.ahead > 0) {
    recommendations.push('ahead-of-upstream');
  }

  if (input.detached) {
    recommendations.push('detached-head');
  }

  return recommendations.length > 0 ? recommendations : ['clean'];
}

function parseGitStatus(label: string, statusStdout: string, logStdout = ''): OperatorGitRepoStatus {
  const statusLines = redactLines(statusStdout.trim().split(/\r?\n/).filter(Boolean));
  const branchLine = statusLines.find((line) => line.startsWith('## ')) ?? null;
  const changes = statusLines.filter((line) => !line.startsWith('## ')).slice(0, 50);
  const branchInfo = parseGitBranchLine(branchLine);
  let modifiedCount = 0;
  let stagedCount = 0;
  let untrackedCount = 0;
  const changedFilePaths: string[] = [];

  for (const line of changes) {
    const indexStatus = line[0] ?? ' ';
    const worktreeStatus = line[1] ?? ' ';

    if (line.startsWith('??')) {
      untrackedCount += 1;
    } else {
      if (indexStatus !== ' ') {
        stagedCount += 1;
      }

      if (worktreeStatus !== ' ') {
        modifiedCount += 1;
      }
    }

    const path = parseChangedFilePath(line);
    if (path && changedFilePaths.length < MAX_REPO_CHANGED_PATHS) {
      changedFilePaths.push(path);
    }
  }

  const lastCommit = parseGitLastCommit(logStdout);
  const recommendations = getRepoRecommendations({
    status: 'available',
    detached: branchInfo.detached,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    modifiedCount,
    stagedCount,
    untrackedCount
  });

  return {
    label,
    status: 'available',
    branch: branchInfo.branch,
    upstream: branchInfo.upstream,
    isDirty: changes.length > 0,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    modifiedCount,
    stagedCount,
    untrackedCount,
    changedFilePaths,
    changes,
    lastCommit,
    recommendations
  };
}

function unavailableGitRepo(label: string, message: string): OperatorGitRepoStatus {
  return {
    label,
    status: 'unavailable',
    branch: null,
    upstream: null,
    isDirty: false,
    ahead: 0,
    behind: 0,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    changedFilePaths: [],
    changes: [],
    lastCommit: null,
    recommendations: ['unavailable'],
    message
  };
}

export async function collectGitStatuses(
  projectRepos: OperatorPathConfig[],
  runCommand: OperatorCommandRunner = defaultOperatorCommandRunner
): Promise<OperatorGitRepoStatus[]> {
  return Promise.all(projectRepos.map(async (repo) => {
    if (!existsSync(repo.path)) {
      return unavailableGitRepo(repo.label, 'Configured repo path is not present.');
    }

    const result = await runCommand('git', ['-C', repo.path, 'status', '--short', '--branch'], { timeoutMs: COMMAND_TIMEOUT_MS });

    if (!result.ok) {
      return unavailableGitRepo(
        repo.label,
        optionalMessage(result.stderr || result.stdout || 'Git status is unavailable.').message ?? 'Git status is unavailable.'
      );
    }

    const logResult = await runCommand('git', ['-C', repo.path, 'log', '-1', '--format=%H%x09%cI%x09%s'], { timeoutMs: COMMAND_TIMEOUT_MS });
    return parseGitStatus(repo.label, result.stdout, logResult.ok ? logResult.stdout : '');
  }));
}

export async function collectHealthChecks(healthChecks: OperatorConfig['healthChecks']): Promise<OperatorHealthCheck[]> {
  return Promise.all(healthChecks.map(async (check) => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(check.url, {
        method: 'GET',
        signal: controller.signal
      });

      return {
        label: check.label,
        status: response.ok ? 'ok' : 'warning',
        urlConfigured: true,
        httpStatus: response.status,
        responseMs: Date.now() - startedAt
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Health check failed.';
      return {
        label: check.label,
        status: 'unknown',
        urlConfigured: true,
        httpStatus: null,
        responseMs: Date.now() - startedAt,
        message: redactSecrets(detail)
      };
    } finally {
      clearTimeout(timeout);
    }
  }));
}

export async function collectOperatorContext(options: {
  config?: OperatorConfig;
  runCommand?: OperatorCommandRunner;
  logger?: OperatorCollectorLogger;
} = {}): Promise<OperatorContext> {
  const collectionWarnings: string[] = [];
  let config: OperatorConfig;

  try {
    config = options.config ?? loadOperatorConfig();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to load operator config.';
    logCollectorWarning(options.logger, 'operator-config', detail);
    collectionWarnings.push('Operator config could not be loaded; using empty safe defaults.');
    config = {
      logPaths: [],
      projectRepos: [],
      diskPaths: [],
      healthChecks: []
    };
  }

  const runCommand = options.runCommand ?? defaultOperatorCommandRunner;
  const [pm2, disks, repos, healthChecks] = await Promise.all([
    collectPm2Status(runCommand),
    collectDiskUsage(config.diskPaths, runCommand),
    collectGitStatuses(config.projectRepos, runCommand),
    collectHealthChecks(config.healthChecks)
  ]);
  const logs = collectConfiguredLogs(config.logPaths);

  for (const warning of config.configWarnings ?? []) {
    logCollectorWarning(options.logger, 'operator-config', warning);
    collectionWarnings.push(warning);
  }

  if (pm2.status !== 'available') {
    logCollectorWarning(options.logger, 'pm2', pm2.message ?? pm2.status);
  }

  for (const disk of disks) {
    if (disk.status !== 'available') {
      logCollectorWarning(options.logger, 'disk', `${disk.label}: ${disk.message ?? disk.status}`);
    }
  }

  for (const repo of repos) {
    if (repo.status !== 'available') {
      logCollectorWarning(options.logger, 'git', `${repo.label}: ${repo.message ?? repo.status}`);
    }
  }

  for (const check of healthChecks) {
    if (check.status !== 'ok') {
      logCollectorWarning(options.logger, 'health', `${check.label}: ${check.message ?? check.status}`);
    }
  }

  for (const log of logs) {
    if (log.status !== 'available') {
      logCollectorWarning(options.logger, 'logs', `${log.label}: ${log.message ?? log.status}`);
    }
  }

  if (config.logPaths.length === 0) {
    collectionWarnings.push('No safe log paths are configured.');
  }

  if (config.projectRepos.length === 0) {
    collectionWarnings.push('No project repositories are configured for git status.');
  }

  if (config.healthChecks.length === 0) {
    collectionWarnings.push('No Caddy/API health check URLs are configured.');
  }

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    pm2,
    system: collectSystemStatus(),
    disks,
    logs,
    repos,
    healthChecks,
    collectionWarnings
  };
}

export function buildOperatorBrief(context: OperatorContext): OperatorBrief {
  const risks: string[] = [];
  const recentEvents: string[] = [];
  const recommendations: string[] = [];
  const overloaded = context.system.loadAverage[0] > context.system.cpuCount * 1.5;
  const highMemory = context.system.memory.usedPercent >= 90;
  const highDisk = context.disks.filter((disk) => (disk.usedPercent ?? 0) >= 90);
  const stoppedProcesses = context.pm2.processes.filter((process) => process.status !== 'online');
  const dirtyRepos = context.repos.filter((repo) => repo.isDirty);
  const unavailableRepos = context.repos.filter((repo) => repo.status !== 'available');
  const unavailableDisks = context.disks.filter((disk) => disk.status !== 'available');
  const unavailableLogs = context.logs.filter((log) => log.status !== 'available');
  const failedHealth = context.healthChecks.filter((check) => check.status !== 'ok');
  const warningCount = [overloaded, highMemory, highDisk.length > 0, stoppedProcesses.length > 0, failedHealth.length > 0].filter(Boolean).length;

  if (overloaded) {
    risks.push(`Load average is elevated (${context.system.loadAverage[0].toFixed(2)} across ${context.system.cpuCount} CPUs).`);
    recommendations.push('Review recent logs and process CPU usage before making service changes.');
  }

  if (highMemory) {
    risks.push(`Memory usage is high at ${context.system.memory.usedPercent.toFixed(1)}%.`);
    recommendations.push('Check PM2 memory figures and recent application errors.');
  }

  for (const disk of highDisk) {
    risks.push(`${disk.label} disk usage is high at ${disk.usedPercent}%.`);
    recommendations.push(`Free space or expand storage for ${disk.label}.`);
  }

  for (const process of stoppedProcesses.slice(0, 3)) {
    risks.push(`${process.name} is ${process.status} in PM2.`);
  }

  if (context.pm2.status !== 'available') {
    risks.push(`PM2 status is ${context.pm2.status}.`);
  }

  for (const disk of unavailableDisks.slice(0, 3)) {
    risks.push(`${disk.label} disk check is ${disk.status}.`);
  }

  for (const check of failedHealth.slice(0, 3)) {
    risks.push(`${check.label} health is ${check.status}${check.httpStatus ? ` (${check.httpStatus})` : ''}.`);
  }

  for (const repo of unavailableRepos.slice(0, 3)) {
    risks.push(`${repo.label} git status is ${repo.status}.`);
  }

  for (const repo of dirtyRepos.slice(0, 3)) {
    recentEvents.push(`${repo.label} has ${repo.changes.length} uncommitted file change${repo.changes.length === 1 ? '' : 's'} (${repo.stagedCount} staged, ${repo.modifiedCount} modified, ${repo.untrackedCount} untracked).`);
  }

  if (context.pm2.status === 'available') {
    const offlineCount = stoppedProcesses.length;
    recentEvents.push(`PM2: ${context.pm2.processCount} process${context.pm2.processCount === 1 ? '' : 'es'} observed, ${offlineCount} non-online.`);
  }

  const highestDisk = [...context.disks]
    .filter((disk) => disk.usedPercent !== null)
    .sort((left, right) => (right.usedPercent ?? 0) - (left.usedPercent ?? 0))[0];

  if (highestDisk?.usedPercent !== null && highestDisk?.usedPercent !== undefined) {
    recentEvents.push(`Disk: ${highestDisk.label} is ${highestDisk.usedPercent}% used.`);
  }

  for (const repo of context.repos.filter((repo) => repo.status === 'available').slice(0, 3)) {
    const upstreamSummary = repo.upstream ? ` tracking ${repo.upstream}` : '';
    const divergenceSummary = repo.ahead > 0 || repo.behind > 0 ? ` (${repo.ahead} ahead, ${repo.behind} behind)` : '';
    const commitSummary = repo.lastCommit ? ` Last commit ${repo.lastCommit.hash}: ${repo.lastCommit.message}` : '';
    recentEvents.push(`Git: ${repo.label} is ${repo.isDirty ? 'dirty' : 'clean'} on ${repo.branch ?? 'unknown branch'}${upstreamSummary}${divergenceSummary}.${commitSummary}`);
  }

  for (const log of context.logs) {
    const lastLine = log.lines.at(-1);
    if (lastLine) {
      recentEvents.push(`${log.label}: ${lastLine.slice(0, 180)}`);
    } else if (log.status !== 'available') {
      recentEvents.push(`${log.label}: ${log.message ?? log.status}`);
    }
  }

  if (context.pm2.status === 'unavailable') {
    recommendations.push('Install or expose PM2 only if this VPS is expected to use it.');
  }

  if (stoppedProcesses.length > 0) {
    recommendations.push('Review PM2 process status from the VPS before taking manual action.');
  }

  if (failedHealth.length > 0) {
    recommendations.push('Check local health endpoints and Caddy routing from the VPS.');
  }

  if (dirtyRepos.length > 0 || unavailableRepos.length > 0) {
    recommendations.push('Review repository state before deploying or pulling updates.');
  }

  if (context.repos.some((repo) => repo.changes.length >= 10)) {
    recommendations.push('Review large local repo change sets before deploy or pull.');
  }

  if (context.repos.some((repo) => repo.recommendations.includes('behind-upstream'))) {
    recommendations.push('Pull only after local repo changes are reviewed.');
  }

  if (context.repos.some((repo) => repo.recommendations.includes('untracked-files-review'))) {
    recommendations.push('Classify untracked files before cleanup.');
  }

  if (highDisk.length > 0 || unavailableDisks.length > 0) {
    recommendations.push('Review disk mounts and free space before changing services.');
  }

  if (unavailableLogs.length > 0) {
    recommendations.push('Review configured operator log paths on the VPS.');
  }

  if (context.collectionWarnings.length > 0) {
    recommendations.push('Complete operator config with explicit safe log paths, repositories, and health URLs.');
  }

  if (risks.length === 0) {
    recommendations.push('No immediate server action is indicated from read-only signals.');
  }

  return {
    generatedAt: context.generatedAt,
    readOnly: true,
    health: risks.some((risk) => risk.toLowerCase().includes('critical')) ? 'critical' : (risks.length > 0 || warningCount > 0 ? 'warning' : 'ok'),
    summary: risks.length === 0
      ? `Server health stable. PM2 ${context.pm2.status}; ${context.disks.length} disk check${context.disks.length === 1 ? '' : 's'}; ${context.repos.length} repo check${context.repos.length === 1 ? '' : 's'}; ${failedHealth.length} health warning${failedHealth.length === 1 ? '' : 's'}.`
      : `${risks.length} operator risk${risks.length === 1 ? '' : 's'} detected. PM2 ${context.pm2.status}; ${highDisk.length} disk warning${highDisk.length === 1 ? '' : 's'}; ${dirtyRepos.length} dirty repo${dirtyRepos.length === 1 ? '' : 's'}; ${failedHealth.length} health warning${failedHealth.length === 1 ? '' : 's'}.`,
    risks: risks.slice(0, 8),
    recentEvents: recentEvents.slice(0, 8),
    recommendations: Array.from(new Set(recommendations)).slice(0, 6)
  };
}

export function buildDashboardOperatorBrief(context: OperatorContext): OperatorBrief {
  const adminBrief = buildOperatorBrief(context);
  const recentEvents: string[] = [];
  const failedHealth = context.healthChecks.filter((check) => check.status !== 'ok');
  const unavailableLogs = context.logs.filter((log) => log.status !== 'available');

  if (context.pm2.status === 'available') {
    recentEvents.push(`PM2 reports ${context.pm2.processCount} process${context.pm2.processCount === 1 ? '' : 'es'}.`);
  } else {
    recentEvents.push('PM2 status is not available to the read-only collector.');
  }

  recentEvents.push(`Git checks: ${context.repos.length} repo${context.repos.length === 1 ? '' : 's'} configured.`);

  for (const repo of context.repos.slice(0, 4)) {
    if (repo.status !== 'available') {
      recentEvents.push(`${repo.label} git status is ${repo.status}.`);
      continue;
    }

    const upstreamSummary = repo.upstream ? ` -> ${repo.upstream}` : '';
    const divergenceSummary = repo.ahead > 0 || repo.behind > 0 ? `, ${repo.ahead} ahead/${repo.behind} behind` : '';
    const changeSummary = repo.isDirty ? `, ${repo.stagedCount} staged/${repo.modifiedCount} modified/${repo.untrackedCount} untracked` : '';
    const commitSummary = repo.lastCommit ? `, last ${repo.lastCommit.hash}` : '';
    recentEvents.push(`${repo.label} is ${repo.isDirty ? 'dirty' : 'clean'}${repo.branch ? ` on ${repo.branch}${upstreamSummary}` : ''}${divergenceSummary}${changeSummary}${commitSummary}.`);
  }

  for (const check of failedHealth.slice(0, 3)) {
    recentEvents.push(`${check.label} health check is ${check.status}.`);
  }

  if (unavailableLogs.length > 0) {
    recentEvents.push(`${unavailableLogs.length} configured log source${unavailableLogs.length === 1 ? '' : 's'} unavailable.`);
  }

  for (const warning of context.collectionWarnings.slice(0, 3)) {
    recentEvents.push(warning);
  }

  return {
    ...adminBrief,
    recentEvents: Array.from(new Set(recentEvents)).slice(0, 8)
  };
}
