import {
  eventTemplateDraftCatalogSchema,
  observedSettingsResponseSchema,
  serverSettingsCapabilitySummarySchema,
  type EventTemplateDraft,
  type EventTemplateDraftCatalog,
  type EventTemplateDraftOverrideRequest,
  type ServerConfig,
  type ObservedSettingChangeRisk,
  type ObservedSettingRecommendedHandling,
  type ObservedSettingValue,
  type ObservedSettingsResponse,
  type ServerSettingsCapabilitySummary,
  type SettingsCandidateWritePath,
  type SettingsWritePathStatus,
  type SupportedSettingGroup
} from '@gameops/shared';
import {
  getEventTemplateDraftOverridesForServer,
  saveEventTemplateDraftOverride,
  type EventTemplateDraftOverrideRecord
} from './event-template-draft-store.js';
import { getLatestPalworldSettingsSnapshotForServer } from './palworld-telemetry-store.js';
import { loadGameOpsConfig } from './server-config.js';

const GROUP_MATCHERS: Array<{ group: SupportedSettingGroup; patterns: RegExp[] }> = [
  {
    group: 'egg/incubation',
    patterns: [/egg/i, /incubat/i, /hatch/i]
  },
  {
    group: 'spawn/world',
    patterns: [/spawn/i, /world/i, /daytime/i, /nighttime/i, /basecamp/i, /pal/i, /max.*num/i]
  },
  {
    group: 'rates',
    patterns: [/rate/i, /exp/i, /drop/i, /damage/i, /stamina/i, /capture/i, /collection/i]
  },
  {
    group: 'difficulty',
    patterns: [/difficulty/i]
  },
  {
    group: 'whitelist/access',
    patterns: [/password/i, /admin/i, /public/i, /ban/i, /allow/i, /white.?list/i, /access/i]
  }
];
const SETTING_GROUP_ORDER: SupportedSettingGroup[] = [
  'rates',
  'egg/incubation',
  'spawn/world',
  'difficulty',
  'whitelist/access',
  'unknown/unmapped'
];
const SENSITIVE_KEY_PATTERN = /(password|token|secret|key|credential|auth)/i;
const ACCESS_RISK_PATTERN = /(password|token|secret|key|credential|admin|access|white.?list|ban|kick|auth)/i;
const BALANCE_RISK_PATTERN = /(xp|exp|rate|drop|gather|collection|capture|incubat|egg|hatch|daytime|nighttime|day|night)/i;
const RESTART_RISK_PATTERN = /(world|spawn|difficulty|basecamp|max.*num)/i;
const SAFE_DISPLAY_PATTERN = /(name|description|message|motd|public|display|region|language)/i;

function getConfiguredServer(serverId: string): ServerConfig | null {
  try {
    return loadGameOpsConfig().servers.find((server) => server.enabled !== false && server.id === serverId) ?? null;
  } catch {
    return null;
  }
}

function getSettingGroup(key: string): SupportedSettingGroup {
  return GROUP_MATCHERS.find((matcher) => matcher.patterns.some((pattern) => pattern.test(key)))?.group ?? 'unknown/unmapped';
}

function getSettingGroups(rawSettings: Record<string, unknown>): SupportedSettingGroup[] {
  const keys = Object.keys(rawSettings);

  if (keys.length === 0) {
    return [];
  }

  const groups = new Set<SupportedSettingGroup>();
  let unmappedCount = 0;

  for (const key of keys) {
    const group = getSettingGroup(key);

    if (group === 'unknown/unmapped') {
      unmappedCount += 1;
    } else {
      groups.add(group);
    }
  }

  if (unmappedCount > 0) {
    groups.add('unknown/unmapped');
  }

  return Array.from(groups);
}

function getValueType(value: unknown): ObservedSettingValue['valueType'] {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return typeof value as ObservedSettingValue['valueType'];
  }

  if (typeof value === 'object') {
    return 'object';
  }

  return 'unknown';
}

function toReadableLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase()) || key;
}

function isSensitiveSettingKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function sanitizeSettingValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSettingValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveSettingKey(key) ? '********' : sanitizeSettingValue(nestedValue)
    ]));
  }

  return value;
}

function getSafetyNote(input: { group: SupportedSettingGroup; sensitive: boolean }): string {
  if (input.sensitive) {
    return 'Sensitive value masked. Read-only; do not expose or change from the dashboard.';
  }

  if (input.group === 'unknown/unmapped') {
    return 'Unmapped setting. Read-only until GameOps understands the setting safely.';
  }

  return 'Observed from Palworld REST. Read-only for now; write behavior is not implemented.';
}

function classifyChangeRisk(input: {
  key: string;
  group: SupportedSettingGroup;
  sensitive: boolean;
}): {
  changeRisk: ObservedSettingChangeRisk;
  riskLabel: string;
  riskNote: string;
  recommendedHandling: ObservedSettingRecommendedHandling;
} {
  if (input.sensitive || ACCESS_RISK_PATTERN.test(input.key) || input.group === 'whitelist/access') {
    return {
      changeRisk: 'dangerous_access_related',
      riskLabel: 'Access risk',
      riskNote: 'Access, auth, or credential-like setting. Never auto-change from GameOps.',
      recommendedHandling: 'never_auto_change'
    };
  }

  if (input.group === 'spawn/world' || input.group === 'difficulty' || RESTART_RISK_PATTERN.test(input.key)) {
    return {
      changeRisk: 'likely_restart_required',
      riskLabel: 'Manual review',
      riskNote: 'May affect world behavior or require restart. Treat as manual review only.',
      recommendedHandling: 'manual_review'
    };
  }

  if (input.group === 'rates' || input.group === 'egg/incubation' || BALANCE_RISK_PATTERN.test(input.key)) {
    return {
      changeRisk: 'gameplay_balance',
      riskLabel: 'Gameplay balance',
      riskNote: 'Could affect progression or pacing. Keep read-only until owner-approved templates exist.',
      recommendedHandling: 'template_candidate'
    };
  }

  if (input.group === 'unknown/unmapped') {
    return {
      changeRisk: 'unknown',
      riskLabel: 'Unknown',
      riskNote: 'GameOps has not mapped this setting yet.',
      recommendedHandling: 'unknown'
    };
  }

  if (SAFE_DISPLAY_PATTERN.test(input.key)) {
    return {
      changeRisk: 'safe_display',
      riskLabel: 'Display only',
      riskNote: 'Useful to display, but still read-only in GameOps.',
      recommendedHandling: 'read_only'
    };
  }

  return {
    changeRisk: 'unknown',
    riskLabel: 'Unknown',
    riskNote: 'GameOps has not classified future change handling for this setting.',
    recommendedHandling: 'unknown'
  };
}

function toObservedSetting(key: string, value: unknown): ObservedSettingValue {
  const group = getSettingGroup(key);
  const sensitive = isSensitiveSettingKey(key);
  const risk = classifyChangeRisk({ key, group, sensitive });

  return {
    key,
    label: toReadableLabel(key),
    group,
    value: sensitive ? '********' : sanitizeSettingValue(value),
    valueType: sensitive ? 'string' : getValueType(value),
    sensitive,
    safetyNote: getSafetyNote({ group, sensitive }),
    writable: false,
    requiresRestart: 'unknown',
    ...risk
  };
}

function keyMatches(setting: ObservedSettingValue, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(setting.key));
}

function toMatchedSetting(setting: ObservedSettingValue): EventTemplateDraft['matchedSettings'][number] {
  return {
    key: setting.key,
    label: setting.label,
    group: setting.group,
    value: setting.value,
    valueType: setting.valueType,
    changeRisk: setting.changeRisk,
    riskLabel: setting.riskLabel,
    recommendedHandling: setting.recommendedHandling
  };
}

function formatPreviewValue(value: unknown, suffix = ''): string {
  if (value === null || value === undefined) {
    return 'unknown';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${Number(value.toFixed(4))}${suffix}` : 'unknown';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'string') {
    return suffix ? `${value}${suffix}` : value;
  }

  return 'observed value';
}

function getFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isMissingObservedValue(value: unknown): boolean {
  return value === null || value === undefined;
}

function buildDraftChangePreviews(draft: EventTemplateDraft): EventTemplateDraft['changePreviews'] {
  return draft.matchedSettings.map((setting) => {
    const previewWarnings: string[] = [];
    const currentValueMissing = isMissingObservedValue(setting.value);
    const currentNumber = getFiniteNumber(setting.value);
    let proposedValue: unknown | null = null;
    let proposedLabel = 'No draft target set';
    let differenceLabel = `No target value or multiplier has been saved for ${setting.label}.`;
    let canPreview = false;

    if (draft.targetValue !== null) {
      proposedValue = draft.targetValue;
      proposedLabel = formatPreviewValue(draft.targetValue);
      canPreview = !currentValueMissing;
      differenceLabel = currentValueMissing
        ? `Would set ${setting.label} to ${proposedLabel}, but the current observed value is missing.`
        : `Would set ${setting.label} from ${formatPreviewValue(setting.value)} to ${proposedLabel}.`;
    } else if (draft.targetMultiplier !== null) {
      proposedLabel = `${formatPreviewValue(draft.targetMultiplier)}x multiplier`;

      if (currentNumber !== null) {
        proposedValue = currentNumber * draft.targetMultiplier;
        canPreview = true;
        differenceLabel = `Would change ${setting.label} from ${formatPreviewValue(currentNumber, 'x')} to ${formatPreviewValue(proposedValue, 'x')}.`;
      } else {
        differenceLabel = `Cannot calculate multiplier preview for ${setting.label}.`;
        previewWarnings.push('Current observed value is not numeric, so multiplier preview is limited.');
      }
    } else {
      previewWarnings.push('No local target value or multiplier has been saved for this draft.');
    }

    if (currentValueMissing) {
      previewWarnings.push('Current observed value is missing.');
    }

    return {
      settingKey: setting.key,
      settingLabel: setting.label,
      currentValue: setting.value,
      proposedValue,
      proposedLabel,
      differenceLabel,
      changeRisk: setting.changeRisk,
      riskLabel: setting.riskLabel,
      recommendedHandling: setting.recommendedHandling,
      canPreview,
      previewWarnings
    };
  });
}

function buildTemplateDraft(input: {
  templateId: string;
  name: string;
  description: string;
  settings: ObservedSettingValue[];
  missingSettings: string[];
}): EventTemplateDraft | null {
  if (input.settings.length === 0) {
    return null;
  }

  return {
    templateId: input.templateId,
    name: input.name,
    description: input.description,
    status: 'draft_only',
    enabledInDashboard: true,
    displayName: null,
    targetMultiplier: null,
    targetValue: null,
    durationHours: null,
    notes: null,
    scheduleLabel: null,
    updatedAt: null,
    matchedSettings: input.settings.map(toMatchedSetting),
    changePreviews: [],
    missingSettings: input.missingSettings,
    safetyNotes: [
      'Preview only. GameOps cannot apply this template.',
      'Only owner-reviewed templates should ever become actions.',
      'Setting writes, scheduling, and restart handling are not implemented.'
    ],
    requiresRestart: 'unknown',
    canApply: false,
    reasonApplyDisabled: 'Event templates are read-only drafts. Apply support has not been built.'
  };
}

function buildDraftsFromObservedSettings(settings: ObservedSettingValue[]): EventTemplateDraft[] {
  const candidates = settings.filter((setting) => setting.recommendedHandling === 'template_candidate');
  const xpSettings = candidates.filter((setting) => keyMatches(setting, [/xp/i, /exp/i]));
  const gatheringSettings = candidates.filter((setting) => keyMatches(setting, [/gather/i, /collection/i, /collect/i]));
  const eggSettings = candidates.filter((setting) => keyMatches(setting, [/egg/i, /incubat/i, /hatch/i]));
  const dropSettings = candidates.filter((setting) => keyMatches(setting, [/drop/i]));
  const catchUpSettings = candidates.filter((setting) => keyMatches(setting, [/xp/i, /exp/i, /drop/i, /gather/i, /collection/i, /collect/i, /capture/i]));
  const drafts = [
    buildTemplateDraft({
      templateId: 'xp-boost-event',
      name: 'XP Boost Event',
      description: 'Draft idea for a temporary progression boost using observed XP or experience rate settings.',
      settings: xpSettings,
      missingSettings: xpSettings.length > 0 ? [] : ['XP or experience rate setting']
    }),
    buildTemplateDraft({
      templateId: 'gathering-boost-event',
      name: 'Gathering Boost Event',
      description: 'Draft idea for a temporary gathering or collection boost using observed rate settings.',
      settings: gatheringSettings,
      missingSettings: gatheringSettings.length > 0 ? [] : ['Gathering or collection rate setting']
    }),
    buildTemplateDraft({
      templateId: 'egg-hatch-incubation-event',
      name: 'Egg Hatch / Incubation Event',
      description: 'Draft idea for a temporary egg hatch or incubation event using observed incubation settings.',
      settings: eggSettings,
      missingSettings: eggSettings.length > 0 ? [] : ['Egg hatch or incubation setting']
    }),
    buildTemplateDraft({
      templateId: 'drop-rate-event',
      name: 'Drop Rate Event',
      description: 'Draft idea for a temporary loot or item drop boost using observed drop rate settings.',
      settings: dropSettings,
      missingSettings: dropSettings.length > 0 ? [] : ['Drop rate setting']
    }),
    buildTemplateDraft({
      templateId: 'weekend-catch-up-event',
      name: 'Weekend Catch-Up Event',
      description: 'Draft idea combining multiple progression rate settings for a weekend catch-up window.',
      settings: catchUpSettings,
      missingSettings: catchUpSettings.length >= 2 ? [] : ['At least two XP, drop, gathering, collection, or capture rate settings']
    })
  ].filter((draft): draft is EventTemplateDraft => draft !== null);

  return drafts.filter((draft) => draft.templateId !== 'weekend-catch-up-event' || draft.matchedSettings.length >= 2);
}

function mergeDraftOverride(draft: EventTemplateDraft, override: EventTemplateDraftOverrideRecord | null): EventTemplateDraft {
  if (!override) {
    return draft;
  }

  return {
    ...draft,
    enabledInDashboard: override.enabledInDashboard,
    displayName: override.displayName,
    targetMultiplier: override.targetMultiplier,
    targetValue: override.targetValue,
    durationHours: override.durationHours,
    notes: override.notes,
    scheduleLabel: override.scheduleLabel,
    updatedAt: override.updatedAt,
    status: 'draft_only',
    canApply: false,
    reasonApplyDisabled: 'No write path has been proven. This is saved as a dashboard draft only.'
  };
}

function mergeDraftOverrides(serverId: string, drafts: EventTemplateDraft[]): EventTemplateDraft[] {
  const overrides = new Map(getEventTemplateDraftOverridesForServer(serverId).map((override) => [override.templateId, override]));

  return drafts.map((draft) => {
    const merged = mergeDraftOverride(draft, overrides.get(draft.templateId) ?? null);
    return {
      ...merged,
      changePreviews: buildDraftChangePreviews(merged)
    };
  });
}

function getMissingRequirementsForPalworldRest(server: ServerConfig): string[] {
  const missing: string[] = [];

  if (server.game !== 'palworld' || server.connector.mode !== 'rest') {
    return missing;
  }

  if (!server.connector.restHost) {
    missing.push('Palworld REST host');
  }

  if (!server.connector.restPort) {
    missing.push('Palworld REST port');
  }

  if (!server.connector.restUsername) {
    missing.push('Palworld REST username');
  }

  if (!server.connector.restPassword) {
    missing.push('Palworld REST password');
  }

  return missing;
}

function getPalworldCandidateWritePaths(server: ServerConfig): SettingsCandidateWritePath[] {
  if (server.game !== 'palworld') {
    return ['manual'];
  }

  const paths = new Set<SettingsCandidateWritePath>(['manual']);

  if (server.connector.mode === 'rest') {
    paths.add('rest');
  }

  if (server.connector.mode === 'rcon') {
    paths.add('rcon');
  }

  if (server.connector.savePath || server.connector.mode === 'file') {
    paths.add('file_edit');
  }

  return Array.from(paths);
}

function getPalworldWritePathStatus(input: {
  server: ServerConfig;
  hasSnapshot: boolean;
  missingRequirements: string[];
}): SettingsWritePathStatus {
  if (input.server.game !== 'palworld') {
    return 'not_supported';
  }

  if (input.server.connector.mode === 'rest') {
    return input.missingRequirements.length > 0 || !input.hasSnapshot
      ? 'blocked_missing_config'
      : 'possible_needs_validation';
  }

  if (input.server.connector.mode === 'rcon' || input.server.connector.mode === 'file') {
    return 'possible_needs_validation';
  }

  return 'unknown';
}

const PALWORLD_WRITE_VALIDATION_STEPS = [
  'Confirm an official Palworld settings update endpoint or command exists for the target server version.',
  'Test against a disposable Palworld server before touching a real world.',
  'Compare the observed settings snapshot before and after a manual change.',
  'Verify whether each setting applies live or only after a restart.',
  'Prove restart detection and post-change health checks before enabling any apply flow.'
];

const PALWORLD_ROLLBACK_REQUIREMENTS = [
  'Backup the authoritative settings source before any change.',
  'Record the previous observed value for every changed setting.',
  'Keep a tested restore path for config files or REST/RCON state.',
  'Define who can restart the server and how GameOps verifies recovery.'
];

const PALWORLD_UNRESOLVED_WRITE_QUESTIONS = [
  'Whether Palworld REST exposes a supported settings mutation endpoint for this server version.',
  'Whether REST settings changes, if supported, are live-editable or restart-required.',
  'Whether RCON can change persistent settings or only execute runtime admin commands.',
  'Which file is authoritative for settings on this host and whether editing it while running is safe.'
];

function unavailable(serverId: string): ServerSettingsCapabilitySummary {
  return serverSettingsCapabilitySummarySchema.parse({
    serverId,
    serverName: null,
    game: null,
    connectorMode: null,
    canReadSettings: 'unknown',
    readSource: 'unknown',
    lastSettingsSnapshotAt: null,
    canWriteSettings: 'no',
    writePathStatus: 'unknown',
    candidateWritePaths: ['manual'],
    requiresRestart: 'unknown',
    supportedSettingGroups: [],
    validationSteps: ['Load a configured server before evaluating settings write paths.'],
    rollbackRequirements: ['No rollback plan can be evaluated without a configured server.'],
    unresolvedQuestions: ['Which game, connector mode, and settings source should be audited.'],
    safetyNotes: [
      'GameOps could not load this server from the current config.',
      'Settings mutation is not implemented.'
    ],
    missingRequirements: ['configured server entry'],
    nextSafeStep: 'Add or fix the server in gameops.config.json, then run the connector until a settings snapshot appears.'
  });
}

export function getServerSettingsCapabilitySummary(serverId: string): ServerSettingsCapabilitySummary {
  const server = getConfiguredServer(serverId);

  if (!server) {
    return unavailable(serverId);
  }

  if (server.game === 'palworld' && server.connector.mode === 'rest') {
    const snapshot = getLatestPalworldSettingsSnapshotForServer(serverId);
    const missingRequirements = getMissingRequirementsForPalworldRest(server);
    const supportedSettingGroups = snapshot ? getSettingGroups(snapshot.raw) : [];
    const candidateWritePaths = getPalworldCandidateWritePaths(server);
    const writePathStatus = getPalworldWritePathStatus({
      server,
      hasSnapshot: Boolean(snapshot),
      missingRequirements
    });

    return serverSettingsCapabilitySummarySchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      game: server.game,
      connectorMode: server.connector.mode,
      canReadSettings: snapshot ? 'yes' : (missingRequirements.length > 0 ? 'no' : 'unknown'),
      readSource: 'Palworld REST',
      lastSettingsSnapshotAt: snapshot?.observedAt ?? null,
      canWriteSettings: 'no',
      writePathStatus,
      candidateWritePaths,
      requiresRestart: 'unknown',
      supportedSettingGroups,
      validationSteps: PALWORLD_WRITE_VALIDATION_STEPS,
      rollbackRequirements: PALWORLD_ROLLBACK_REQUIREMENTS,
      unresolvedQuestions: PALWORLD_UNRESOLVED_WRITE_QUESTIONS,
      safetyNotes: [
        snapshot
          ? 'Palworld REST settings have been observed and are available for read-only auditing.'
          : 'Palworld REST settings are configured as a readable source, but no settings snapshot has been stored yet.',
        'GameOps does not currently implement settings writes.',
        'Restart requirements are not verified by GameOps yet.'
      ],
      missingRequirements: snapshot
        ? ['settings write implementation', 'restart policy', 'rollback plan']
        : [...missingRequirements, 'settings snapshot', 'settings write implementation', 'restart policy'].filter(Boolean),
      nextSafeStep: snapshot
        ? 'Map the observed settings keys into owner-approved read-only groups before designing any write workflow.'
        : 'Run the Palworld REST connector until a settings snapshot is captured.'
    });
  }

  if (server.game === 'valheim') {
    return serverSettingsCapabilitySummarySchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      game: server.game,
      connectorMode: server.connector.mode,
      canReadSettings: 'unknown',
      readSource: server.connector.mode === 'file' ? 'config file' : 'unknown',
      lastSettingsSnapshotAt: null,
      canWriteSettings: 'no',
      writePathStatus: 'not_supported',
      candidateWritePaths: ['manual'],
      requiresRestart: 'unknown',
      supportedSettingGroups: [],
      validationSteps: ['Add a read-only settings parser before evaluating any write path.'],
      rollbackRequirements: ['Identify and back up the authoritative settings source before any future change.'],
      unresolvedQuestions: ['Which Valheim settings source is authoritative for this host.'],
      safetyNotes: [
        'Valheim connector support currently focuses on activity logs, not server settings.',
        'GameOps does not currently implement settings writes.',
        'Manual review is required before changing Valheim server startup or world settings.'
      ],
      missingRequirements: ['settings file path mapping', 'restart command', 'settings parser', 'settings write implementation'],
      nextSafeStep: 'Identify the authoritative Valheim settings source and add a read-only parser before considering changes.'
    });
  }

  return serverSettingsCapabilitySummarySchema.parse({
    serverId: server.id,
    serverName: server.displayName,
    game: server.game,
    connectorMode: server.connector.mode,
    canReadSettings: 'no',
    readSource: 'unavailable',
    lastSettingsSnapshotAt: null,
    canWriteSettings: 'no',
    writePathStatus: server.game === 'palworld'
      ? getPalworldWritePathStatus({ server, hasSnapshot: false, missingRequirements: [] })
      : 'not_supported',
    candidateWritePaths: server.game === 'palworld' ? getPalworldCandidateWritePaths(server) : ['manual'],
    requiresRestart: 'unknown',
    supportedSettingGroups: [],
    validationSteps: server.game === 'palworld'
      ? PALWORLD_WRITE_VALIDATION_STEPS
      : ['Add a read-only settings source before evaluating any write path.'],
    rollbackRequirements: server.game === 'palworld'
      ? PALWORLD_ROLLBACK_REQUIREMENTS
      : ['Identify and back up the authoritative settings source before any future change.'],
    unresolvedQuestions: server.game === 'palworld'
      ? PALWORLD_UNRESOLVED_WRITE_QUESTIONS
      : ['Which settings source and connector mode should be used.'],
    safetyNotes: [
      'This connector mode does not currently expose server settings to GameOps.',
      'GameOps does not currently implement settings writes.'
    ],
    missingRequirements: ['readable settings source', 'settings write implementation', 'restart policy'],
    nextSafeStep: 'Add a read-only settings source for this connector mode before designing settings changes.'
  });
}

export function getObservedServerSettings(serverId: string): ObservedSettingsResponse {
  const server = getConfiguredServer(serverId);

  if (!server) {
    return observedSettingsResponseSchema.parse({
      serverId,
      serverName: null,
      game: null,
      connectorMode: null,
      available: false,
      source: 'unknown',
      snapshotAt: null,
      groups: [],
      safetyNotes: [
        'GameOps could not load this server from the current config.',
        'Settings are read-only; writes are not implemented.'
      ],
      emptyState: 'No configured server was found for this settings request.'
    });
  }

  if (server.game !== 'palworld' || server.connector.mode !== 'rest') {
    return observedSettingsResponseSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      game: server.game,
      connectorMode: server.connector.mode,
      available: false,
      source: server.game === 'valheim' && server.connector.mode === 'file' ? 'config file' : 'unavailable',
      snapshotAt: null,
      groups: [],
      safetyNotes: [
        'This server does not currently expose readable settings snapshots through Palworld REST.',
        'Settings are read-only; writes are not implemented.'
      ],
      emptyState: 'Observed settings are unavailable for this game or connector mode.'
    });
  }

  const snapshot = getLatestPalworldSettingsSnapshotForServer(serverId);

  if (!snapshot) {
    return observedSettingsResponseSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      game: server.game,
      connectorMode: server.connector.mode,
      available: false,
      source: 'Palworld REST',
      snapshotAt: null,
      groups: [],
      safetyNotes: [
        'Palworld REST settings are configured as a readable source, but no settings snapshot has been stored yet.',
        'Settings are read-only; writes are not implemented.'
      ],
      emptyState: 'No Palworld settings snapshot has been observed yet.'
    });
  }

  const settings = Object.entries(snapshot.raw)
    .map(([key, value]) => toObservedSetting(key, value))
    .sort((left, right) => (
      SETTING_GROUP_ORDER.indexOf(left.group) - SETTING_GROUP_ORDER.indexOf(right.group)
      || left.label.localeCompare(right.label)
    ));
  const groups = SETTING_GROUP_ORDER
    .map((group) => ({
      group,
      settings: settings.filter((setting) => setting.group === group)
    }))
    .filter((group) => group.settings.length > 0);

  return observedSettingsResponseSchema.parse({
    serverId: server.id,
    serverName: server.displayName,
    game: server.game,
    connectorMode: server.connector.mode,
    available: true,
    source: 'Palworld REST',
    snapshotAt: snapshot.observedAt,
    groups,
    safetyNotes: [
      'Observed settings are read-only for now.',
      'Sensitive setting values are masked before they reach the dashboard.',
      'Restart requirements are unknown until a safe settings workflow is designed.'
    ],
    emptyState: null
  });
}

export function getEventTemplateDraftCatalog(serverId: string): EventTemplateDraftCatalog {
  const observed = getObservedServerSettings(serverId);

  if (!observed.available) {
    return eventTemplateDraftCatalogSchema.parse({
      serverId: observed.serverId,
      serverName: observed.serverName,
      game: observed.game,
      sourceSnapshotAt: observed.snapshotAt,
      status: observed.source === 'Palworld REST' ? 'empty' : 'unavailable',
      explanation: observed.emptyState ?? 'Observed settings are unavailable, so no event template drafts can be suggested.',
      drafts: [],
      safetyNotes: [
        'Preview only. GameOps cannot apply templates.',
        'No writes, scheduling, RCON, REST mutation, or restart handling is implemented.'
      ]
    });
  }

  const observedSettings = observed.groups.flatMap((group) => group.settings);
  const drafts = mergeDraftOverrides(observed.serverId, buildDraftsFromObservedSettings(observedSettings));

  return eventTemplateDraftCatalogSchema.parse({
    serverId: observed.serverId,
    serverName: observed.serverName,
    game: observed.game,
    sourceSnapshotAt: observed.snapshotAt,
    status: drafts.length > 0 ? 'available' : 'empty',
    explanation: drafts.length > 0
      ? 'Draft templates are based on observed settings classified as template candidates.'
      : 'No observed template-candidate settings were found.',
    drafts,
    safetyNotes: [
      'Drafts are previews only.',
      'Unknown or unmapped settings are not used to create drafts.',
      'Apply support has not been built.'
    ]
  });
}

export function saveEventTemplateDraftCustomization(input: {
  serverId: string;
  templateId: string;
  override: EventTemplateDraftOverrideRequest;
}): EventTemplateDraftCatalog | null {
  const catalog = getEventTemplateDraftCatalog(input.serverId);

  if (!catalog.drafts.some((draft) => draft.templateId === input.templateId)) {
    return null;
  }

  saveEventTemplateDraftOverride({
    serverId: input.serverId,
    templateId: input.templateId,
    override: input.override
  });

  return getEventTemplateDraftCatalog(input.serverId);
}
