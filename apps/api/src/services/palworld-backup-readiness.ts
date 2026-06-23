import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { palworldBackupReadinessSchema, type PalworldBackupReadiness } from '@gameops/shared';
import { getPalworldConfigAudit } from './palworld-config-audit.js';
import { getPalworldRuntimeAudit } from './palworld-runtime-audit.js';
import { getCachedResult } from './request-performance.js';

const BACKUP_READINESS_CACHE_TTL_MS = 120_000;

const ROLLBACK_REQUIREMENTS = [
  'Backup the selected PalWorldSettings.ini before any future config change.',
  'Record the exact previous value for every changed setting.',
  'Keep a restore procedure that replaces the changed file with the backup.',
  'Validate server health and settings after any manual restore.',
  'Do not automate access, password, admin, whitelist, ban, kick, or auth-like settings.'
];

const VALIDATION_STEPS = [
  'Confirm the selected config file is authoritative for the running Palworld server.',
  'Confirm the proposed backup directory is writable by the operator before any future backup tool exists.',
  'Test manual restore on a disposable server before enabling writes.',
  'Define whether a restart is required after restore.',
  'Compare REST-observed settings after restore to verify the expected values returned.'
];

const SAFETY_WARNINGS = [
  'Read-only audit only. No backup file has been created.',
  'GameOps cannot restore files or restart the server.',
  'Backup readiness does not prove config editing is safe.'
];

function getReadable(path: string): boolean {
  try {
    readFileSync(path, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function computePalworldBackupReadiness(serverId: string): PalworldBackupReadiness {
  const audit = getPalworldConfigAudit(serverId);
  const runtimeAudit = getPalworldRuntimeAudit(serverId);
  const selectedPath = audit.selectedPath;
  const proposedBackupDirectory = selectedPath ? join(dirname(selectedPath), 'gameops-backups') : null;
  const proposedBackupFilenamePattern = selectedPath ? 'PalWorldSettings.ini.{timestamp}.bak' : null;
  const runtimeAlignmentStatus = runtimeAudit.runtimeAuditStatus === 'matched_active_config'
    ? 'matched'
    : runtimeAudit.runtimeAuditStatus === 'mismatched_config'
      ? 'mismatched'
      : runtimeAudit.runtimeAuditStatus === 'active_config_unreadable'
        ? 'unreadable'
        : 'unknown';
  const runtimeSafetyWarnings = [
    ...(runtimeAlignmentStatus === 'mismatched'
      ? [`Active runtime config appears to be ${runtimeAudit.inferredActiveConfigPath}, but backup readiness selected ${selectedPath ?? 'no config file'}.`]
      : []),
    ...(runtimeAlignmentStatus === 'unknown'
      ? ['Active runtime config could not be identified from systemd; backup readiness is based on config discovery only.']
      : []),
    ...(runtimeAlignmentStatus === 'unreadable'
      ? ['Active runtime config matches discovery but is not readable.']
      : [])
  ];

  if (!selectedPath) {
    return palworldBackupReadinessSchema.parse({
      serverId,
      serverName: audit.serverName,
      readinessStatus: audit.discoveryStatus === 'candidate_not_found' ? 'blocked_missing_config_file' : 'unknown',
      filesToBackup: audit.candidatePaths.map((path) => ({
        path,
        exists: false,
        readable: false,
        reason: 'Candidate config file was not found.'
      })),
      proposedBackupDirectory,
      proposedBackupFilenamePattern,
      activeRuntimeConfigPath: runtimeAudit.inferredActiveConfigPath,
      runtimeConfigMatchesSelected: runtimeAudit.pathsMatch,
      runtimeAlignmentStatus,
      rollbackRequirements: ROLLBACK_REQUIREMENTS,
      validationSteps: VALIDATION_STEPS,
      safetyWarnings: [
        ...SAFETY_WARNINGS,
        ...runtimeSafetyWarnings,
        'No selected config file is available to include in a backup plan.'
      ],
      canCreateBackup: false,
      reasonCreateBackupDisabled: 'Backup creation is not implemented. This endpoint only audits readiness.'
    });
  }

  const exists = existsSync(selectedPath);
  const readable = exists ? getReadable(selectedPath) : false;
  const readinessStatus = runtimeAlignmentStatus === 'mismatched'
    ? 'unknown'
    : !exists
    ? 'blocked_missing_config_file'
    : readable
      ? 'ready_for_manual_backup_plan'
      : 'blocked_unreadable_file';

  return palworldBackupReadinessSchema.parse({
    serverId,
    serverName: audit.serverName,
    readinessStatus,
    filesToBackup: [{
      path: selectedPath,
      exists,
      readable,
      reason: readable
        ? 'Selected Palworld settings file can be read and can be included in a manual backup plan.'
        : exists
          ? 'Selected Palworld settings file exists but could not be read.'
          : 'Selected Palworld settings file does not exist.'
    }],
    proposedBackupDirectory,
    proposedBackupFilenamePattern,
    activeRuntimeConfigPath: runtimeAudit.inferredActiveConfigPath,
    runtimeConfigMatchesSelected: runtimeAudit.pathsMatch,
    runtimeAlignmentStatus,
    rollbackRequirements: ROLLBACK_REQUIREMENTS,
    validationSteps: VALIDATION_STEPS,
    safetyWarnings: [
      ...SAFETY_WARNINGS,
      ...runtimeSafetyWarnings
    ],
    canCreateBackup: false,
    reasonCreateBackupDisabled: 'Backup creation is not implemented. This endpoint only audits readiness.'
  });
}

export function getPalworldBackupReadiness(serverId: string): PalworldBackupReadiness {
  return getCachedResult(`palworld-backup-readiness:${serverId}`, BACKUP_READINESS_CACHE_TTL_MS, () => computePalworldBackupReadiness(serverId));
}
