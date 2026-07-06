import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ObservedSettingsResponse,
  PalworldBackupReadiness,
  PalworldConfigAudit,
  PalworldRuntimeAudit,
  ServerSettingsCapabilitySummary
} from '@gameops/shared';
import { buildPalworldApplyReadinessReport, type PalworldApplyReadinessProposedChange } from '../src/palworld-apply-readiness.ts';

const now = '2026-07-06T12:00:00.000Z';
const configPath = '/pal1/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini';

function capabilities(overrides: Partial<ServerSettingsCapabilitySummary> = {}): ServerSettingsCapabilitySummary {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    game: 'palworld',
    connectorMode: 'rest',
    canReadSettings: 'yes',
    readSource: 'Palworld REST',
    lastSettingsSnapshotAt: now,
    canWriteSettings: 'no',
    writePathStatus: 'possible_needs_validation',
    candidateWritePaths: ['manual', 'rest'],
    requiresRestart: 'unknown',
    supportedSettingGroups: ['rates'],
    validationSteps: ['Verify final values after the server is back online.'],
    rollbackRequirements: ['Record previous values before changing anything.'],
    unresolvedQuestions: ['Restart requirement is unknown.'],
    safetyNotes: ['Read-only settings are available.'],
    missingRequirements: ['server settings change implementation'],
    nextSafeStep: 'Review settings.',
    ...overrides
  };
}

function observedSettings(): ObservedSettingsResponse {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    game: 'palworld',
    connectorMode: 'rest',
    available: true,
    source: 'Palworld REST',
    snapshotAt: now,
    groups: [{
      group: 'rates',
      settings: [{
        key: 'ExpRate',
        label: 'Exp Rate',
        value: 2,
        valueType: 'number',
        sensitive: false,
        group: 'rates',
        safetyNote: 'Gameplay setting.',
        writable: false,
        recommendedHandling: 'template_candidate',
        changeRisk: 'gameplay_balance',
        requiresRestart: 'unknown',
        riskLabel: 'Gameplay balance',
        riskNote: 'Could affect progression.'
      }]
    }],
    safetyNotes: [],
    emptyState: null
  };
}

function configAudit(overrides: Partial<PalworldConfigAudit> = {}): PalworldConfigAudit {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    discoveryStatus: 'found',
    candidatePaths: [configPath],
    selectedPath: configPath,
    canReadFile: true,
    parseStatus: 'parsed',
    parsedSettingCount: 1,
    matchedRestSettings: [{
      key: 'ExpRate',
      fileValue: 2,
      restValue: 2,
      valuesMatch: true
    }],
    unmatchedFileSettings: [],
    unmatchedRestSettings: [],
    fileEditViability: 'possible_needs_backup_restart_validation',
    safetyWarnings: [],
    nextValidationSteps: ['Verify file path.'],
    ...overrides
  };
}

function runtimeAudit(overrides: Partial<PalworldRuntimeAudit> = {}): PalworldRuntimeAudit {
  return {
    serverId: 'palworld-1',
    servicePath: '/etc/systemd/system/palworld.service',
    serviceReadable: true,
    workingDirectory: '/pal1',
    execStart: '/pal1/PalServer.sh',
    inferredActiveConfigPath: configPath,
    inferredActiveConfigExists: true,
    inferredActiveConfigReadable: true,
    selectedConfigAuditPath: configPath,
    pathsMatch: true,
    runtimeAuditStatus: 'matched_active_config',
    summary: 'Active config matches.',
    safetyWarnings: [],
    ...overrides
  };
}

function backupReadiness(overrides: Partial<PalworldBackupReadiness> = {}): PalworldBackupReadiness {
  return {
    serverId: 'palworld-1',
    serverName: 'Fantasy World',
    readinessStatus: 'ready_for_manual_backup_plan',
    filesToBackup: [{
      path: configPath,
      exists: true,
      readable: true,
      reason: 'Config file can be included in a manual backup plan.'
    }],
    proposedBackupDirectory: '/root/gameops-backups/palworld',
    proposedBackupFilenamePattern: 'PalWorldSettings.ini.TIMESTAMP.bak',
    activeRuntimeConfigPath: configPath,
    runtimeConfigMatchesSelected: true,
    runtimeAlignmentStatus: 'matched',
    rollbackRequirements: ['Restore original value.'],
    validationSteps: ['Verify backup exists.'],
    safetyWarnings: [],
    canCreateBackup: false,
    reasonCreateBackupDisabled: 'Backup creation is not implemented.',
    ...overrides
  };
}

function proposedChanges(overrides: Partial<PalworldApplyReadinessProposedChange> = {}): PalworldApplyReadinessProposedChange[] {
  return [{
    key: 'ExpRate',
    label: 'Exp Rate',
    currentValue: 2,
    proposedValue: 4,
    canPreviewValue: true,
    warning: null,
    ...overrides
  }];
}

test('keeps future server changes disabled when mandatory safety gates are missing', () => {
  const report = buildPalworldApplyReadinessReport({
    capabilities: capabilities({ requiresRestart: 'unknown' }),
    observedSettings: observedSettings(),
    configAudit: configAudit({ selectedPath: null }),
    runtimeAudit: runtimeAudit({
      selectedConfigAuditPath: null,
      pathsMatch: false,
      runtimeAuditStatus: 'mismatched_config',
      safetyWarnings: ['Active config needs owner verification.']
    }),
    backupReadiness: backupReadiness({
      readinessStatus: 'unknown',
      filesToBackup: [],
      runtimeConfigMatchesSelected: false,
      runtimeAlignmentStatus: 'mismatched',
      reasonCreateBackupDisabled: 'No config file is available to include in a backup plan.'
    }),
    proposedChanges: proposedChanges({ proposedValue: null, canPreviewValue: false, warning: 'Current value is not numeric.' })
  });

  assert.equal(report.status, 'not_ready_to_apply');
  assert.equal(report.label, 'Not ready to apply');
  assert.equal(report.blocked.some((gate) => gate.name === 'Proposed changes valid'), true);
  assert.equal(report.blocked.some((gate) => gate.name === 'Backup requirement'), true);
  assert.equal(report.blocked.some((gate) => gate.name === 'Operator confirmation requirement'), true);
  assert.match(report.reasonDisabled, /Future server changes stay disabled/);
});

test('keeps final confirmation gate blocked even when evidence is complete', () => {
  const report = buildPalworldApplyReadinessReport({
    capabilities: capabilities({ requiresRestart: 'no' }),
    observedSettings: observedSettings(),
    configAudit: configAudit(),
    runtimeAudit: runtimeAudit(),
    backupReadiness: backupReadiness(),
    proposedChanges: proposedChanges()
  });

  assert.equal(report.status, 'not_ready_to_apply');
  assert.equal(report.ready.some((gate) => gate.name === 'Active settings source'), true);
  assert.equal(report.ready.some((gate) => gate.name === 'Config path known'), true);
  assert.equal(report.ready.some((gate) => gate.name === 'Current settings readable'), true);
  assert.equal(report.ready.some((gate) => gate.name === 'Proposed changes valid'), true);
  assert.equal(report.ready.some((gate) => gate.name === 'Backup requirement'), true);
  assert.equal(report.ready.some((gate) => gate.name === 'Restart requirement'), true);
  assert.deepEqual(report.blocked.map((gate) => gate.name), ['Operator confirmation requirement']);
});
