import {
  eventTemplateManualEditPlanSchema,
  type EventTemplateManualEditPlan
} from '@gameops/shared';
import { getEventTemplateConfigDiffPreview } from './event-template-config-diff-preview.js';
import { getEventTemplateManualChangeChecklist } from './event-template-manual-change-checklist.js';
import { getPalworldBackupReadiness } from './palworld-backup-readiness.js';
import { getPalworldRuntimeAudit } from './palworld-runtime-audit.js';
import { getEventTemplateDraftCatalog } from './settings-capabilities.js';

const MANUAL_STEPS = [
  'Confirm the target config path is the active Palworld server config.',
  'Create a backup of PalWorldSettings.ini before editing.',
  'Stop the server first if restart behavior is unknown or the operator requires offline edits.',
  'Edit only the listed keys to the listed values.',
  'Restart palworld.service if needed.',
  'Verify the next REST settings snapshot shows the expected values.',
  'Watch connector health, activity, and error logs after the manual change.'
];

function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function buildBackupRecommendation(input: {
  targetConfigPath: string | null;
  proposedBackupDirectory: string | null;
  proposedBackupFilenamePattern: string | null;
}): string {
  if (!input.targetConfigPath) {
    return 'No target config file is available, so no backup plan can be described.';
  }

  if (!input.proposedBackupDirectory || !input.proposedBackupFilenamePattern) {
    return `Before editing, manually back up ${input.targetConfigPath}.`;
  }

  return `Before editing, manually copy ${input.targetConfigPath} to ${input.proposedBackupDirectory}/${input.proposedBackupFilenamePattern}.`;
}

function buildCopyableText(input: {
  templateName: string;
  planStatus: EventTemplateManualEditPlan['planStatus'];
  targetConfigPath: string | null;
  backupRecommendation: string;
  exactChanges: EventTemplateManualEditPlan['exactChanges'];
  manualSteps: string[];
  warnings: string[];
}): string {
  const changes = input.exactChanges.length > 0
    ? input.exactChanges.map((change) => `- ${change.key}: ${formatValue(change.fromValue)} -> ${formatValue(change.toValue)}`).join('\n')
    : '- No exact config key changes are available.';
  const warnings = input.warnings.length > 0
    ? input.warnings.map((warning) => `- ${warning}`).join('\n')
    : '- No additional warnings.';

  return [
    `Manual edit plan: ${input.templateName}`,
    `Status: ${input.planStatus}`,
    `Target config: ${input.targetConfigPath ?? 'unknown'}`,
    '',
    'Backup:',
    input.backupRecommendation,
    '',
    'Exact changes:',
    changes,
    '',
    'Manual steps:',
    input.manualSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    '',
    'Warnings:',
    warnings,
    '',
    'This is instructions only. GameOps will not change the server.'
  ].join('\n');
}

export function getEventTemplateManualEditPlan(serverId: string, templateId: string): EventTemplateManualEditPlan | null {
  const catalog = getEventTemplateDraftCatalog(serverId);
  const draft = catalog.drafts.find((candidate) => candidate.templateId === templateId);

  if (!draft) {
    return null;
  }

  const diffPreview = getEventTemplateConfigDiffPreview(serverId, templateId);
  const checklist = getEventTemplateManualChangeChecklist(serverId, templateId);
  const backupReadiness = getPalworldBackupReadiness(serverId);
  const runtimeAudit = getPalworldRuntimeAudit(serverId);
  const targetConfigPath = diffPreview?.targetConfigPath ?? backupReadiness.filesToBackup[0]?.path ?? null;
  const exactChanges = diffPreview?.changes
    .filter((change) => change.proposedValue !== null)
    .map((change) => ({
      key: change.key,
      fromValue: change.currentFileValue,
      toValue: change.proposedValue
    })) ?? [];
  const warnings = Array.from(new Set([
    ...(diffPreview?.safetyWarnings ?? []),
    ...(checklist?.checklistItems
      .filter((item) => item.status === 'warning' || item.status === 'blocked')
      .map((item) => `${item.label}: ${item.detail}`) ?? []),
    ...backupReadiness.safetyWarnings,
    ...runtimeAudit.safetyWarnings,
    'This is instructions only. GameOps will not change the server.'
  ]));
  const planStatus: EventTemplateManualEditPlan['planStatus'] = checklist?.checklistStatus === 'blocked'
    ? 'blocked'
    : diffPreview?.previewStatus === 'available' && checklist?.checklistStatus === 'ready_for_manual_review'
      ? 'available'
      : 'limited';
  const backupRecommendation = buildBackupRecommendation({
    targetConfigPath,
    proposedBackupDirectory: backupReadiness.proposedBackupDirectory,
    proposedBackupFilenamePattern: backupReadiness.proposedBackupFilenamePattern
  });
  const copyableText = buildCopyableText({
    templateName: draft.displayName ?? draft.name,
    planStatus,
    targetConfigPath,
    backupRecommendation,
    exactChanges,
    manualSteps: MANUAL_STEPS,
    warnings
  });

  return eventTemplateManualEditPlanSchema.parse({
    serverId,
    templateId,
    planStatus,
    targetConfigPath,
    backupRecommendation,
    exactChanges,
    manualSteps: MANUAL_STEPS,
    copyableText,
    warnings,
    canApply: false
  });
}
