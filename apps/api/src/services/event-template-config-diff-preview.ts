import {
  eventTemplateConfigDiffPreviewSchema,
  type EventTemplateConfigDiffPreview,
  type EventTemplateDraft,
  type ObservedSettingValueType,
  type PalworldRuntimeConfigAlignmentStatus
} from '@gameops/shared';
import { getPalworldParsedConfigContext, normalizePalworldSettingKey } from './palworld-config-audit.js';
import { getPalworldRuntimeAudit } from './palworld-runtime-audit.js';
import { getEventTemplateDraftCatalog } from './settings-capabilities.js';

function getValueType(value: unknown): ObservedSettingValueType {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return typeof value as ObservedSettingValueType;
  }

  if (typeof value === 'object') {
    return 'object';
  }

  return 'unknown';
}

function getFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getFileKeyByObservedKey(fileSettings: Record<string, unknown>, observedKey: string): string | null {
  const normalizedObservedKey = normalizePalworldSettingKey(observedKey);
  return Object.keys(fileSettings).find((fileKey) => normalizePalworldSettingKey(fileKey) === normalizedObservedKey) ?? null;
}

function getProposedValue(input: {
  draft: EventTemplateDraft;
  fileValue: unknown;
  observedValue: unknown;
  warningNotes: string[];
}): unknown | null {
  if (input.draft.targetValue !== null) {
    return input.draft.targetValue;
  }

  if (input.draft.targetMultiplier === null) {
    input.warningNotes.push('No target value or multiplier has been saved for this draft.');
    return null;
  }

  const currentFileNumber = getFiniteNumber(input.fileValue);

  if (currentFileNumber !== null) {
    return Number((currentFileNumber * input.draft.targetMultiplier).toFixed(6));
  }

  const observedNumber = getFiniteNumber(input.observedValue);

  if (observedNumber !== null) {
    input.warningNotes.push('File value is not numeric, so proposed value was estimated from the observed REST value.');
    return Number((observedNumber * input.draft.targetMultiplier).toFixed(6));
  }

  input.warningNotes.push('Multiplier preview requires a numeric file or observed value.');
  return null;
}

function unavailable(input: {
  serverId: string;
  templateId: string;
  selectedConfigPath: string | null;
  targetConfigPath: string | null;
  activeRuntimeConfigPath: string | null;
  runtimeConfigMatchesSelected: boolean;
  runtimeAlignmentStatus: PalworldRuntimeConfigAlignmentStatus;
  runtimeWarnings: string[];
  reason: string;
}): EventTemplateConfigDiffPreview {
  return eventTemplateConfigDiffPreviewSchema.parse({
    serverId: input.serverId,
    templateId: input.templateId,
    selectedConfigPath: input.selectedConfigPath,
    targetConfigPath: input.targetConfigPath,
    activeRuntimeConfigPath: input.activeRuntimeConfigPath,
    runtimeConfigMatchesSelected: input.runtimeConfigMatchesSelected,
    runtimeAlignmentStatus: input.runtimeAlignmentStatus,
    previewStatus: 'unavailable',
    changes: [],
    missingKeys: [],
    unmappedSettings: [],
    safetyWarnings: [
      ...input.runtimeWarnings,
      input.reason,
      'Read-only preview only. GameOps cannot apply config file changes.'
    ],
    canApply: false,
    reasonApplyDisabled: 'No config write path, backup workflow, or restart validation has been proven.'
  });
}

function getRuntimeAlignment(serverId: string, selectedConfigPath: string | null): {
  targetConfigPath: string | null;
  activeRuntimeConfigPath: string | null;
  runtimeConfigMatchesSelected: boolean;
  runtimeAlignmentStatus: PalworldRuntimeConfigAlignmentStatus;
  runtimeWarnings: string[];
} {
  const runtimeAudit = getPalworldRuntimeAudit(serverId);
  const activeRuntimeConfigPath = runtimeAudit.inferredActiveConfigPath;

  if (runtimeAudit.runtimeAuditStatus === 'matched_active_config' && activeRuntimeConfigPath) {
    return {
      targetConfigPath: activeRuntimeConfigPath,
      activeRuntimeConfigPath,
      runtimeConfigMatchesSelected: true,
      runtimeAlignmentStatus: 'matched',
      runtimeWarnings: []
    };
  }

  if (runtimeAudit.runtimeAuditStatus === 'mismatched_config' && activeRuntimeConfigPath) {
    return {
      targetConfigPath: selectedConfigPath,
      activeRuntimeConfigPath,
      runtimeConfigMatchesSelected: false,
      runtimeAlignmentStatus: 'mismatched',
      runtimeWarnings: [
        `Active runtime config appears to be ${activeRuntimeConfigPath}, but GameOps selected ${selectedConfigPath ?? 'no config file'}.`,
        'Manual preflight is blocked until the configured savePath points at the active Palworld server config.'
      ]
    };
  }

  if (runtimeAudit.runtimeAuditStatus === 'active_config_unreadable' && activeRuntimeConfigPath) {
    return {
      targetConfigPath: selectedConfigPath,
      activeRuntimeConfigPath,
      runtimeConfigMatchesSelected: runtimeAudit.pathsMatch,
      runtimeAlignmentStatus: 'unreadable',
      runtimeWarnings: [
        `Active runtime config appears to be ${activeRuntimeConfigPath}, but GameOps cannot read it.`,
        'Manual preflight is limited until the active config file can be read.'
      ]
    };
  }

  return {
    targetConfigPath: selectedConfigPath,
    activeRuntimeConfigPath,
    runtimeConfigMatchesSelected: false,
    runtimeAlignmentStatus: 'unknown',
    runtimeWarnings: [
      'Active runtime config could not be identified from systemd, so GameOps is falling back to config discovery.'
    ]
  };
}

export function getEventTemplateConfigDiffPreview(serverId: string, templateId: string): EventTemplateConfigDiffPreview | null {
  const catalog = getEventTemplateDraftCatalog(serverId);
  const draft = catalog.drafts.find((candidate) => candidate.templateId === templateId);

  if (!draft) {
    return null;
  }

  const context = getPalworldParsedConfigContext(serverId);
  const runtimeAlignment = getRuntimeAlignment(serverId, context.audit.selectedPath);

  if (context.audit.parseStatus !== 'parsed' || !context.audit.selectedPath) {
    return unavailable({
      serverId,
      templateId,
      selectedConfigPath: context.audit.selectedPath,
      ...runtimeAlignment,
      reason: 'No readable parsed PalWorldSettings.ini file is available for this server.'
    });
  }

  const missingKeys: string[] = [];
  const unmappedSettings: string[] = [];
  const changes: EventTemplateConfigDiffPreview['changes'] = [];

  for (const setting of draft.matchedSettings) {
    const fileKey = getFileKeyByObservedKey(context.settings, setting.key);

    if (!fileKey) {
      missingKeys.push(setting.key);
      unmappedSettings.push(setting.key);
      continue;
    }

    const warningNotes: string[] = [];
    const currentFileValue = context.settings[fileKey];
    const proposedValue = getProposedValue({
      draft,
      fileValue: currentFileValue,
      observedValue: setting.value,
      warningNotes
    });

    changes.push({
      key: fileKey,
      currentFileValue,
      currentObservedValue: setting.value,
      proposedValue,
      valueType: getValueType(currentFileValue),
      riskLabel: setting.riskLabel,
      warningNotes
    });
  }

  const limited = missingKeys.length > 0
    || unmappedSettings.length > 0
    || changes.length === 0
    || changes.some((change) => change.proposedValue === null || change.warningNotes.length > 0)
    || runtimeAlignment.runtimeAlignmentStatus === 'mismatched'
    || runtimeAlignment.runtimeAlignmentStatus === 'unreadable';

  return eventTemplateConfigDiffPreviewSchema.parse({
    serverId,
    templateId,
    selectedConfigPath: context.audit.selectedPath,
    targetConfigPath: runtimeAlignment.targetConfigPath,
    activeRuntimeConfigPath: runtimeAlignment.activeRuntimeConfigPath,
    runtimeConfigMatchesSelected: runtimeAlignment.runtimeConfigMatchesSelected,
    runtimeAlignmentStatus: runtimeAlignment.runtimeAlignmentStatus,
    previewStatus: limited ? 'limited' : 'available',
    changes,
    missingKeys: Array.from(new Set(missingKeys)).sort(),
    unmappedSettings: Array.from(new Set(unmappedSettings)).sort(),
    safetyWarnings: [
      ...runtimeAlignment.runtimeWarnings,
      'Read-only preview only. GameOps will not edit PalWorldSettings.ini.',
      'A diff preview does not prove file editing is safe or live-reloadable.',
      'Backup, rollback, and restart validation are still required before any write path.'
    ],
    canApply: false,
    reasonApplyDisabled: 'No config write path, backup workflow, or restart validation has been proven.'
  });
}
