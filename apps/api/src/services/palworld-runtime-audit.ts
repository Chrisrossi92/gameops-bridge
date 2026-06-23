import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, normalize, resolve } from 'node:path';
import { palworldRuntimeAuditSchema, type PalworldRuntimeAudit } from '@gameops/shared';
import { getPalworldConfigAudit } from './palworld-config-audit.js';
import { getCachedResult } from './request-performance.js';

const DEFAULT_PALWORLD_SERVICE_PATH = '/etc/systemd/system/palworld.service';
const RUNTIME_AUDIT_CACHE_TTL_MS = 120_000;

function getServicePath(): string {
  return process.env.PALWORLD_SYSTEMD_SERVICE_PATH?.trim() || DEFAULT_PALWORLD_SERVICE_PATH;
}

function stripSystemdValue(value: string): string {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSystemdUnit(contents: string): { workingDirectory: string | null; execStart: string | null } {
  let workingDirectory: string | null = null;
  let execStart: string | null = null;

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = stripSystemdValue(line.slice(separatorIndex + 1));

    if (key === 'WorkingDirectory' && value) {
      workingDirectory = value;
    }

    if (key === 'ExecStart' && value) {
      execStart = value;
    }
  }

  return { workingDirectory, execStart };
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function isReadableFile(path: string): boolean {
  return readText(path) !== null;
}

function normalizePathForCompare(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return normalize(isAbsolute(path) ? path : resolve(process.cwd(), path));
}

function buildResponse(input: Omit<PalworldRuntimeAudit, 'safetyWarnings'> & { safetyWarnings?: string[] }): PalworldRuntimeAudit {
  return palworldRuntimeAuditSchema.parse({
    ...input,
    safetyWarnings: [
      'Read-only runtime audit only. GameOps does not edit systemd units or config files.',
      ...(input.safetyWarnings ?? [])
    ]
  });
}

function computePalworldRuntimeAudit(serverId: string): PalworldRuntimeAudit {
  const servicePath = getServicePath();
  const configAudit = getPalworldConfigAudit(serverId);
  const selectedConfigAuditPath = configAudit.selectedPath;
  const serviceContents = readText(servicePath);

  if (serviceContents === null) {
    return buildResponse({
      serverId,
      servicePath,
      serviceReadable: false,
      workingDirectory: null,
      execStart: null,
      inferredActiveConfigPath: null,
      inferredActiveConfigExists: false,
      inferredActiveConfigReadable: false,
      selectedConfigAuditPath,
      pathsMatch: false,
      runtimeAuditStatus: 'missing_systemd_service',
      summary: 'Palworld systemd service file is not readable, so the active runtime config path is unknown.',
      safetyWarnings: ['Unable to compare configured savePath against the running service WorkingDirectory.']
    });
  }

  const parsed = parseSystemdUnit(serviceContents);

  if (!parsed.workingDirectory) {
    return buildResponse({
      serverId,
      servicePath,
      serviceReadable: true,
      workingDirectory: null,
      execStart: parsed.execStart,
      inferredActiveConfigPath: null,
      inferredActiveConfigExists: false,
      inferredActiveConfigReadable: false,
      selectedConfigAuditPath,
      pathsMatch: false,
      runtimeAuditStatus: 'missing_working_directory',
      summary: 'Palworld systemd service is readable, but it does not declare WorkingDirectory.',
      safetyWarnings: ['Cannot infer the active PalWorldSettings.ini path without WorkingDirectory.']
    });
  }

  const workingDirectory = normalizePathForCompare(parsed.workingDirectory) ?? parsed.workingDirectory;
  const inferredActiveConfigPath = normalizePathForCompare(
    `${workingDirectory}/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini`
  );
  const normalizedSelectedPath = normalizePathForCompare(selectedConfigAuditPath);
  const inferredActiveConfigExists = inferredActiveConfigPath ? existsSync(inferredActiveConfigPath) : false;
  const inferredActiveConfigReadable = inferredActiveConfigPath ? isReadableFile(inferredActiveConfigPath) : false;
  const pathsMatch = Boolean(inferredActiveConfigPath && normalizedSelectedPath && inferredActiveConfigPath === normalizedSelectedPath);
  const runtimeAuditStatus = pathsMatch
    ? inferredActiveConfigReadable
      ? 'matched_active_config'
      : 'active_config_unreadable'
    : 'mismatched_config';
  const summary = pathsMatch
    ? `Active Palworld config appears to be ${inferredActiveConfigPath}.`
    : inferredActiveConfigPath
      ? `Warning: active Palworld config appears to be ${inferredActiveConfigPath}, but GameOps selected ${selectedConfigAuditPath ?? 'no config file'}.`
      : 'Unable to infer active Palworld config path.';

  return buildResponse({
    serverId,
    servicePath,
    serviceReadable: true,
    workingDirectory,
    execStart: parsed.execStart,
    inferredActiveConfigPath,
    inferredActiveConfigExists,
    inferredActiveConfigReadable,
    selectedConfigAuditPath,
    pathsMatch,
    runtimeAuditStatus,
    summary,
    safetyWarnings: [
      ...(pathsMatch ? [] : ['Configured savePath may not point at the running Palworld server config.']),
      ...(inferredActiveConfigExists ? [] : ['Inferred active config file does not exist.']),
      ...(inferredActiveConfigExists && !inferredActiveConfigReadable ? ['Inferred active config file exists but is not readable.'] : [])
    ]
  });
}

export function getPalworldRuntimeAudit(serverId: string): PalworldRuntimeAudit {
  return getCachedResult(`palworld-runtime-audit:${serverId}`, RUNTIME_AUDIT_CACHE_TTL_MS, () => computePalworldRuntimeAudit(serverId));
}
