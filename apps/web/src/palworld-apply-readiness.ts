import type {
  ObservedSettingsResponse,
  PalworldBackupReadiness,
  PalworldConfigAudit,
  PalworldRuntimeAudit,
  ServerSettingsCapabilitySummary
} from '@gameops/shared';

export type PalworldApplyReadinessStatus = 'ready_for_future_implementation' | 'not_ready_to_apply';
export type PalworldApplyReadinessGateStatus = 'ready' | 'blocked' | 'needs_review';

export interface PalworldApplyReadinessGate {
  name: string;
  status: PalworldApplyReadinessGateStatus;
  detail: string;
}

export interface PalworldApplyReadinessProposedChange {
  key: string;
  label: string;
  currentValue: unknown;
  proposedValue: unknown | null;
  canPreviewValue: boolean;
  warning: string | null;
}

export interface PalworldApplyReadinessReport {
  status: PalworldApplyReadinessStatus;
  label: string;
  ready: PalworldApplyReadinessGate[];
  blocked: PalworldApplyReadinessGate[];
  needsReview: PalworldApplyReadinessGate[];
  reasonDisabled: string;
  requiredSafetySteps: string[];
}

export interface BuildPalworldApplyReadinessInput {
  capabilities: ServerSettingsCapabilitySummary;
  observedSettings: ObservedSettingsResponse | null;
  configAudit: PalworldConfigAudit | null;
  runtimeAudit: PalworldRuntimeAudit | null;
  backupReadiness: PalworldBackupReadiness | null;
  proposedChanges: PalworldApplyReadinessProposedChange[];
}

function countReadableSettings(observedSettings: ObservedSettingsResponse | null): number {
  return observedSettings?.available
    ? observedSettings.groups.reduce((sum, group) => sum + group.settings.length, 0)
    : 0;
}

function getKnownConfigPath(input: BuildPalworldApplyReadinessInput): string | null {
  return input.backupReadiness?.activeRuntimeConfigPath
    ?? input.runtimeAudit?.inferredActiveConfigPath
    ?? input.configAudit?.selectedPath
    ?? null;
}

function gate(name: string, status: PalworldApplyReadinessGateStatus, detail: string): PalworldApplyReadinessGate {
  return { name, status, detail };
}

function getProposedChangesGate(changes: PalworldApplyReadinessProposedChange[]): PalworldApplyReadinessGate {
  if (changes.length === 0) {
    return gate('Proposed changes valid', 'blocked', 'No preset changes are available from readable settings yet.');
  }

  const invalidChanges = changes.filter((change) => !change.canPreviewValue || change.proposedValue === null || change.warning);

  if (invalidChanges.length > 0) {
    return gate(
      'Proposed changes valid',
      'blocked',
      `${invalidChanges.length} proposed change${invalidChanges.length === 1 ? '' : 's'} cannot be safely previewed from current readable values.`
    );
  }

  return gate('Proposed changes valid', 'ready', `${changes.length} proposed change${changes.length === 1 ? '' : 's'} can be previewed from readable current values.`);
}

function getRestartGate(capabilities: ServerSettingsCapabilitySummary): PalworldApplyReadinessGate {
  if (capabilities.requiresRestart === 'no') {
    return gate('Restart requirement', 'ready', 'Current evidence says restart is not required.');
  }

  if (capabilities.requiresRestart === 'yes') {
    return gate('Restart requirement', 'needs_review', 'Restart is likely required and must be handled manually until a safe restart workflow exists.');
  }

  return gate('Restart requirement', 'needs_review', 'Restart requirement is unknown and needs owner verification before future server changes.');
}

function buildGates(input: BuildPalworldApplyReadinessInput): PalworldApplyReadinessGate[] {
  const readableSettingsCount = countReadableSettings(input.observedSettings);
  const knownConfigPath = getKnownConfigPath(input);
  const runtimePathsAligned = input.runtimeAudit?.runtimeAuditStatus === 'matched_active_config'
    || input.runtimeAudit?.pathsMatch === true;

  return [
    input.capabilities.readSource !== 'unavailable' && input.capabilities.readSource !== 'unknown'
      ? gate('Active settings source', 'ready', `Settings source is ${input.capabilities.readSource}.`)
      : gate('Active settings source', 'blocked', 'No active settings source is verified.'),
    knownConfigPath
      ? gate('Config path known', runtimePathsAligned ? 'ready' : 'needs_review', runtimePathsAligned
        ? `Active config path is ${knownConfigPath}.`
        : `Config path is ${knownConfigPath}, but the active runtime path still needs manual verification.`)
      : gate('Config path known', 'blocked', 'GameOps does not know the active Palworld settings file path yet.'),
    input.capabilities.canReadSettings === 'yes' && input.observedSettings?.available && readableSettingsCount > 0
      ? gate('Current settings readable', 'ready', `${readableSettingsCount} current setting value${readableSettingsCount === 1 ? '' : 's'} are readable.`)
      : gate('Current settings readable', 'blocked', 'Current settings are not readable enough for a future server-change workflow.'),
    getProposedChangesGate(input.proposedChanges),
    input.backupReadiness?.readinessStatus === 'ready_for_manual_backup_plan'
      ? gate('Backup requirement', 'ready', 'Backup target information is ready for manual planning.')
      : gate('Backup requirement', 'blocked', input.backupReadiness?.reasonCreateBackupDisabled ?? 'Backup requirements are not ready yet.'),
    getRestartGate(input.capabilities),
    input.capabilities.validationSteps.length > 0
      ? gate('Verification requirement', 'needs_review', 'Verification steps are documented, but final value checks are not automated.')
      : gate('Verification requirement', 'blocked', 'No verification steps are documented.'),
    input.capabilities.rollbackRequirements.length > 0 && input.proposedChanges.length > 0
      ? gate('Rollback requirement', 'needs_review', 'Rollback notes can use the current observed values, but restore is still manual.')
      : gate('Rollback requirement', 'blocked', 'Rollback cannot be planned until current values and rollback requirements are available.'),
    gate('Operator confirmation requirement', 'blocked', 'A double-confirm owner workflow is not implemented yet.')
  ];
}

export function buildPalworldApplyReadinessReport(input: BuildPalworldApplyReadinessInput): PalworldApplyReadinessReport {
  const gates = buildGates(input);
  const ready = gates.filter((item) => item.status === 'ready');
  const blocked = gates.filter((item) => item.status === 'blocked');
  const needsReview = gates.filter((item) => item.status === 'needs_review');
  const status: PalworldApplyReadinessStatus = blocked.length === 0
    ? 'ready_for_future_implementation'
    : 'not_ready_to_apply';

  return {
    status,
    label: status === 'ready_for_future_implementation'
      ? 'Ready for future implementation'
      : 'Not ready to apply',
    ready,
    blocked,
    needsReview,
    reasonDisabled: blocked.length > 0
      ? `${blocked.length} safety gate${blocked.length === 1 ? '' : 's'} blocked. Future server changes stay disabled.`
      : 'Safety gates are documented for a future implementation. Future server changes stay disabled until a separate write workflow exists.',
    requiredSafetySteps: [
      'Prove the active settings source and config path before future server changes.',
      'Create and verify a backup before any future setting change.',
      'Decide how restart requirements will be handled and verified.',
      'Verify final values after any future change workflow.',
      'Keep rollback values tied to the current observed settings.',
      'Require explicit owner confirmation before any future server change.'
    ]
  };
}
