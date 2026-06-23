import {
  eventTemplateManualChangeChecklistSchema,
  type EventTemplateManualChangeChecklist,
  type EventTemplateManualChecklistItem
} from '@gameops/shared';
import { getEventTemplateConfigDiffPreview } from './event-template-config-diff-preview.js';
import { getPalworldBackupReadiness } from './palworld-backup-readiness.js';
import { getPalworldConfigAudit } from './palworld-config-audit.js';
import { getPalworldRuntimeAudit } from './palworld-runtime-audit.js';
import { getEventTemplateDraftCatalog, getServerSettingsCapabilitySummary } from './settings-capabilities.js';

const REQUIRED_MANUAL_STEPS = [
  'Stop the server if the setting requires it or if restart behavior is unknown.',
  'Back up the selected PalWorldSettings.ini file before editing.',
  'Edit only the listed config keys and values from the diff preview.',
  'Restart the server if needed.',
  'Verify the next REST settings snapshot shows the expected values.',
  'Watch activity, connector health, and error logs after the manual change.'
];

function getOverallStatus(items: EventTemplateManualChecklistItem[]): EventTemplateManualChangeChecklist['checklistStatus'] {
  if (items.some((item) => item.status === 'blocked')) {
    return 'blocked';
  }

  if (items.some((item) => item.status === 'warning')) {
    return 'limited';
  }

  return 'ready_for_manual_review';
}

function hasDraftTarget(draft: ReturnType<typeof getEventTemplateDraftCatalog>['drafts'][number]): boolean {
  return draft.targetValue !== null || draft.targetMultiplier !== null;
}

export function getEventTemplateManualChangeChecklist(serverId: string, templateId: string): EventTemplateManualChangeChecklist | null {
  const catalog = getEventTemplateDraftCatalog(serverId);
  const draft = catalog.drafts.find((candidate) => candidate.templateId === templateId);

  if (!draft) {
    return null;
  }

  const configAudit = getPalworldConfigAudit(serverId);
  const backupReadiness = getPalworldBackupReadiness(serverId);
  const runtimeAudit = getPalworldRuntimeAudit(serverId);
  const capabilities = getServerSettingsCapabilitySummary(serverId);
  const diffPreview = getEventTemplateConfigDiffPreview(serverId, templateId);
  const items: EventTemplateManualChecklistItem[] = [];

  items.push({
    label: 'Draft target',
    status: hasDraftTarget(draft) ? 'pass' : 'blocked',
    detail: hasDraftTarget(draft)
      ? 'A local dashboard draft target value or multiplier is saved.'
      : 'Save a target value or multiplier before a manual change can be reviewed.'
  });

  items.push({
    label: 'Config file',
    status: configAudit.discoveryStatus === 'found' && configAudit.parseStatus === 'parsed' && configAudit.selectedPath
      ? 'pass'
      : 'blocked',
    detail: configAudit.selectedPath
      ? `Selected config file: ${configAudit.selectedPath}`
      : 'No readable parsed PalWorldSettings.ini file is selected.'
  });

  items.push({
    label: 'Active runtime config identified',
    status: runtimeAudit.inferredActiveConfigPath ? 'pass' : 'warning',
    detail: runtimeAudit.inferredActiveConfigPath
      ? `Active runtime config appears to be ${runtimeAudit.inferredActiveConfigPath}.`
      : 'Active runtime config could not be identified from systemd. Falling back to config discovery.'
  });

  items.push({
    label: 'Draft targets active server config',
    status: runtimeAudit.inferredActiveConfigPath
      ? diffPreview?.targetConfigPath === runtimeAudit.inferredActiveConfigPath && runtimeAudit.pathsMatch
        ? 'pass'
        : 'blocked'
      : 'warning',
    detail: runtimeAudit.inferredActiveConfigPath
      ? diffPreview?.targetConfigPath === runtimeAudit.inferredActiveConfigPath && runtimeAudit.pathsMatch
        ? `Target config: ${runtimeAudit.inferredActiveConfigPath}`
        : `Draft target is ${diffPreview?.targetConfigPath ?? 'unknown'}, but active runtime config appears to be ${runtimeAudit.inferredActiveConfigPath}.`
      : `Target config: ${diffPreview?.targetConfigPath ?? configAudit.selectedPath ?? 'unknown'}. Runtime audit is unavailable.`
  });

  items.push({
    label: 'Runtime/config audit path match',
    status: runtimeAudit.inferredActiveConfigPath
      ? runtimeAudit.pathsMatch
        ? 'pass'
        : 'blocked'
      : 'warning',
    detail: runtimeAudit.inferredActiveConfigPath
      ? runtimeAudit.pathsMatch
        ? 'The systemd WorkingDirectory config path matches the config discovery path.'
        : `Runtime path ${runtimeAudit.inferredActiveConfigPath} does not match selected config ${runtimeAudit.selectedConfigAuditPath ?? 'none'}.`
      : 'Cannot compare runtime and config discovery paths without a readable systemd WorkingDirectory.'
  });

  items.push({
    label: 'Config diff',
    status: diffPreview?.previewStatus === 'available'
      ? 'pass'
      : diffPreview?.previewStatus === 'limited'
        ? 'warning'
        : 'blocked',
    detail: diffPreview
      ? `${diffPreview.changes.length} change(s), ${diffPreview.missingKeys.length} missing key(s), ${diffPreview.unmappedSettings.length} unmapped setting(s).`
      : 'No config diff preview is available for this draft.'
  });

  items.push({
    label: 'Backup plan',
    status: backupReadiness.readinessStatus === 'ready_for_manual_backup_plan' ? 'pass' : 'blocked',
    detail: backupReadiness.filesToBackup[0]?.path
      ? `${backupReadiness.readinessStatus}: ${backupReadiness.filesToBackup[0].path}`
      : 'No config file is available to include in a backup plan.'
  });

  items.push({
    label: 'Restart requirement',
    status: capabilities.requiresRestart === 'no'
      ? 'pass'
      : capabilities.requiresRestart === 'yes'
        ? 'warning'
        : 'warning',
    detail: capabilities.requiresRestart === 'unknown'
      ? 'Restart behavior is unknown. Manual operator must decide whether to stop/restart before and after editing.'
      : `Restart requirement is reported as ${capabilities.requiresRestart}.`
  });

  items.push({
    label: 'Write path',
    status: capabilities.canWriteSettings === 'yes' ? 'warning' : 'info',
    detail: capabilities.canWriteSettings === 'yes'
      ? 'A write path is reported, but this checklist still does not apply changes.'
      : 'GameOps has no enabled write path. This checklist is manual review only.'
  });

  return eventTemplateManualChangeChecklistSchema.parse({
    serverId,
    templateId,
    checklistStatus: getOverallStatus(items),
    checklistItems: items,
    requiredManualSteps: REQUIRED_MANUAL_STEPS,
    ownerConfirmationText: 'I understand this checklist does not change the server. I must manually back up files, edit settings, handle restarts, and verify the server afterward.',
    canApply: false,
    reasonApplyDisabled: 'GameOps has no proven config write path, backup creation, restore flow, restart command, or apply workflow.'
  });
}
