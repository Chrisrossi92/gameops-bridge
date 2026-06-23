import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { palworldBackupReadinessSchema, type PalworldBackupReadiness } from '@gameops/shared';
import { getPalworldConfigAudit } from './palworld-config-audit.js';

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

export function getPalworldBackupReadiness(serverId: string): PalworldBackupReadiness {
  const audit = getPalworldConfigAudit(serverId);
  const selectedPath = audit.selectedPath;
  const proposedBackupDirectory = selectedPath ? join(dirname(selectedPath), 'gameops-backups') : null;
  const proposedBackupFilenamePattern = selectedPath ? 'PalWorldSettings.ini.{timestamp}.bak' : null;

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
      rollbackRequirements: ROLLBACK_REQUIREMENTS,
      validationSteps: VALIDATION_STEPS,
      safetyWarnings: [
        ...SAFETY_WARNINGS,
        'No selected config file is available to include in a backup plan.'
      ],
      canCreateBackup: false,
      reasonCreateBackupDisabled: 'Backup creation is not implemented. This endpoint only audits readiness.'
    });
  }

  const exists = existsSync(selectedPath);
  const readable = exists ? getReadable(selectedPath) : false;
  const readinessStatus = !exists
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
    rollbackRequirements: ROLLBACK_REQUIREMENTS,
    validationSteps: VALIDATION_STEPS,
    safetyWarnings: SAFETY_WARNINGS,
    canCreateBackup: false,
    reasonCreateBackupDisabled: 'Backup creation is not implemented. This endpoint only audits readiness.'
  });
}
