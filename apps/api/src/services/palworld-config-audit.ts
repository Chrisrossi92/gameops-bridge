import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { palworldConfigAuditSchema, type PalworldConfigAudit, type ServerConfig } from '@gameops/shared';
import { getLatestPalworldSettingsSnapshotForServer } from './palworld-telemetry-store.js';
import { loadGameOpsConfig } from './server-config.js';

const PALWORLD_SETTINGS_FILE = 'PalWorldSettings.ini';

export interface PalworldParsedConfigContext {
  audit: PalworldConfigAudit;
  settings: Record<string, unknown>;
}

function getConfiguredServer(serverId: string): ServerConfig | null {
  try {
    return loadGameOpsConfig().servers.find((server) => server.enabled !== false && server.id === serverId) ?? null;
  } catch {
    return null;
  }
}

function resolveConfiguredPath(configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildCandidatePaths(server: ServerConfig): string[] {
  if (server.game !== 'palworld') {
    return [];
  }

  const roots = [
    server.connector.savePath,
    server.connector.logPath ? dirname(server.connector.logPath) : undefined
  ]
    .filter((path): path is string => Boolean(path?.trim()))
    .map((path) => resolveConfiguredPath(path));

  const candidates: string[] = [];

  for (const root of roots) {
    candidates.push(
      resolve(root, 'Config', 'LinuxServer', PALWORLD_SETTINGS_FILE),
      resolve(root, 'Config', 'WindowsServer', PALWORLD_SETTINGS_FILE),
      resolve(root, PALWORLD_SETTINGS_FILE),
      resolve(root, 'Saved', 'Config', 'LinuxServer', PALWORLD_SETTINGS_FILE),
      resolve(root, 'Saved', 'Config', 'WindowsServer', PALWORLD_SETTINGS_FILE),
      resolve(root, 'Pal', 'Saved', 'Config', 'LinuxServer', PALWORLD_SETTINGS_FILE),
      resolve(root, 'Pal', 'Saved', 'Config', 'WindowsServer', PALWORLD_SETTINGS_FILE)
    );
  }

  return unique(candidates);
}

function splitAssignments(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (const character of value) {
    if ((character === '"' || character === "'") && !quote) {
      quote = character;
      current += character;
      continue;
    }

    if (quote === character) {
      quote = null;
      current += character;
      continue;
    }

    if (!quote && ['(', '[', '{'].includes(character)) {
      depth += 1;
    }

    if (!quote && [')', ']', '}'].includes(character) && depth > 0) {
      depth -= 1;
    }

    if (character === ',' && !quote && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseValue(rawValue: string): unknown {
  const value = rawValue.trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (/^(true|false)$/i.test(value)) {
    return /^true$/i.test(value);
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

function parseAssignmentInto(settings: Map<string, unknown>, assignment: string): void {
  const separatorIndex = assignment.indexOf('=');

  if (separatorIndex <= 0) {
    return;
  }

  const key = assignment.slice(0, separatorIndex).trim();
  const value = assignment.slice(separatorIndex + 1).trim();

  if (!key || value.length === 0) {
    return;
  }

  settings.set(key, parseValue(value));
}

function parsePalworldSettingsIni(contents: string): Record<string, unknown> {
  const settings = new Map<string, unknown>();
  const optionSettingsMatch = /OptionSettings\s*=\s*\(([\s\S]*)\)/m.exec(contents);

  if (optionSettingsMatch?.[1]) {
    for (const assignment of splitAssignments(optionSettingsMatch[1])) {
      parseAssignmentInto(settings, assignment);
    }
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('[') || line.startsWith(';') || line.startsWith('#') || /^OptionSettings\s*=/i.test(line)) {
      continue;
    }

    parseAssignmentInto(settings, line);
  }

  return Object.fromEntries(settings);
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function normalizePalworldSettingKey(key: string): string {
  return normalizeKey(key);
}

function normalizeComparableValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number(value.toFixed(6)).toString();
  }

  if (typeof value === 'string') {
    const numeric = Number(value);

    if (value.trim() && Number.isFinite(numeric)) {
      return Number(numeric.toFixed(6)).toString();
    }

    return value.trim();
  }

  return JSON.stringify(value);
}

function buildRestComparison(fileSettings: Record<string, unknown>, restSettings: Record<string, unknown> | null): {
  matchedRestSettings: PalworldConfigAudit['matchedRestSettings'];
  unmatchedFileSettings: string[];
  unmatchedRestSettings: string[];
} {
  if (!restSettings) {
    return {
      matchedRestSettings: [],
      unmatchedFileSettings: Object.keys(fileSettings).sort(),
      unmatchedRestSettings: []
    };
  }

  const restByNormalizedKey = new Map(Object.keys(restSettings).map((key) => [normalizeKey(key), key]));
  const matchedRestKeys = new Set<string>();
  const matchedRestSettings: PalworldConfigAudit['matchedRestSettings'] = [];
  const unmatchedFileSettings: string[] = [];

  for (const [fileKey, fileValue] of Object.entries(fileSettings)) {
    const restKey = restByNormalizedKey.get(normalizeKey(fileKey));

    if (!restKey) {
      unmatchedFileSettings.push(fileKey);
      continue;
    }

    const restValue = restSettings[restKey];
    matchedRestKeys.add(restKey);
    matchedRestSettings.push({
      key: fileKey,
      fileValue,
      restValue,
      valuesMatch: normalizeComparableValue(fileValue) === normalizeComparableValue(restValue)
    });
  }

  return {
    matchedRestSettings: matchedRestSettings.sort((left, right) => left.key.localeCompare(right.key)),
    unmatchedFileSettings: unmatchedFileSettings.sort(),
    unmatchedRestSettings: Object.keys(restSettings)
      .filter((key) => !matchedRestKeys.has(key))
      .sort()
  };
}

function unsupported(serverId: string): PalworldConfigAudit {
  return palworldConfigAuditSchema.parse({
    serverId,
    serverName: null,
    discoveryStatus: 'unsupported',
    candidatePaths: [],
    selectedPath: null,
    canReadFile: false,
    parseStatus: 'not_attempted',
    parsedSettingCount: 0,
    matchedRestSettings: [],
    unmatchedFileSettings: [],
    unmatchedRestSettings: [],
    fileEditViability: 'not_viable',
    safetyWarnings: ['No configured Palworld server was found for this audit.'],
    nextValidationSteps: ['Add a Palworld server config with a savePath before auditing config files.']
  });
}

export function getPalworldConfigAudit(serverId: string): PalworldConfigAudit {
  const server = getConfiguredServer(serverId);

  if (!server || server.game !== 'palworld') {
    return unsupported(serverId);
  }

  const candidatePaths = buildCandidatePaths(server);
  const snapshot = getLatestPalworldSettingsSnapshotForServer(serverId);
  const restSettings = snapshot?.raw ?? null;

  if (candidatePaths.length === 0) {
    return palworldConfigAuditSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      discoveryStatus: 'no_config_path',
      candidatePaths,
      selectedPath: null,
      canReadFile: false,
      parseStatus: 'not_attempted',
      parsedSettingCount: 0,
      matchedRestSettings: [],
      unmatchedFileSettings: [],
      unmatchedRestSettings: restSettings ? Object.keys(restSettings).sort() : [],
      fileEditViability: 'unknown',
      safetyWarnings: ['No Palworld savePath or related config path is configured.'],
      nextValidationSteps: ['Configure the Palworld savePath that contains the server Saved directory.']
    });
  }

  const selectedPath = candidatePaths.find((path) => existsSync(path)) ?? null;

  if (!selectedPath) {
    return palworldConfigAuditSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      discoveryStatus: 'candidate_not_found',
      candidatePaths,
      selectedPath: null,
      canReadFile: false,
      parseStatus: 'not_attempted',
      parsedSettingCount: 0,
      matchedRestSettings: [],
      unmatchedFileSettings: [],
      unmatchedRestSettings: restSettings ? Object.keys(restSettings).sort() : [],
      fileEditViability: 'unknown',
      safetyWarnings: ['No PalWorldSettings.ini candidate file was found.'],
      nextValidationSteps: ['Confirm the Palworld savePath and server platform-specific Config directory.']
    });
  }

  let contents: string;

  try {
    contents = readFileSync(selectedPath, 'utf8');
  } catch {
    return palworldConfigAuditSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      discoveryStatus: 'found',
      candidatePaths,
      selectedPath,
      canReadFile: false,
      parseStatus: 'unreadable',
      parsedSettingCount: 0,
      matchedRestSettings: [],
      unmatchedFileSettings: [],
      unmatchedRestSettings: restSettings ? Object.keys(restSettings).sort() : [],
      fileEditViability: 'not_viable',
      safetyWarnings: ['A candidate settings file exists, but GameOps could not read it.'],
      nextValidationSteps: ['Fix read permissions before evaluating file-edit viability.']
    });
  }

  const parsedSettings = parsePalworldSettingsIni(contents);
  const parsedSettingCount = Object.keys(parsedSettings).length;

  if (parsedSettingCount === 0) {
    return palworldConfigAuditSchema.parse({
      serverId: server.id,
      serverName: server.displayName,
      discoveryStatus: 'found',
      candidatePaths,
      selectedPath,
      canReadFile: true,
      parseStatus: 'failed',
      parsedSettingCount: 0,
      matchedRestSettings: [],
      unmatchedFileSettings: [],
      unmatchedRestSettings: restSettings ? Object.keys(restSettings).sort() : [],
      fileEditViability: 'not_viable',
      safetyWarnings: ['A settings file was found, but no settings could be parsed from it.'],
      nextValidationSteps: ['Verify this is the authoritative PalWorldSettings.ini file before considering writes.']
    });
  }

  const comparison = buildRestComparison(parsedSettings, restSettings);
  const allMatchedValuesAgree = comparison.matchedRestSettings.length > 0
    && comparison.matchedRestSettings.every((setting) => setting.valuesMatch);

  return palworldConfigAuditSchema.parse({
    serverId: server.id,
    serverName: server.displayName,
    discoveryStatus: 'found',
    candidatePaths,
    selectedPath,
    canReadFile: true,
    parseStatus: 'parsed',
    parsedSettingCount,
    ...comparison,
    fileEditViability: allMatchedValuesAgree
      ? 'possible_needs_backup_restart_validation'
      : 'unknown',
    safetyWarnings: [
      'Read-only audit only. File editing is not implemented.',
      'Finding and parsing a file does not prove it is safe to edit while the server is running.',
      ...(comparison.matchedRestSettings.length === 0 ? ['No parsed file settings matched the latest REST settings snapshot.'] : []),
      ...(comparison.matchedRestSettings.some((setting) => !setting.valuesMatch) ? ['Some matching file and REST settings have different values.'] : [])
    ],
    nextValidationSteps: [
      'Confirm the selected file is the authoritative Palworld settings file.',
      'Create a backup and rollback design before any write path exists.',
      'Validate whether edits require restart on a disposable server.',
      'Compare parsed file settings after a manual owner-approved change.'
    ]
  });
}

export function getPalworldParsedConfigContext(serverId: string): PalworldParsedConfigContext {
  const audit = getPalworldConfigAudit(serverId);

  if (audit.discoveryStatus !== 'found' || audit.parseStatus !== 'parsed' || !audit.selectedPath || !audit.canReadFile) {
    return {
      audit,
      settings: {}
    };
  }

  try {
    return {
      audit,
      settings: parsePalworldSettingsIni(readFileSync(audit.selectedPath, 'utf8'))
    };
  } catch {
    return {
      audit: palworldConfigAuditSchema.parse({
        ...audit,
        canReadFile: false,
        parseStatus: 'unreadable',
        parsedSettingCount: 0,
        fileEditViability: 'not_viable',
        safetyWarnings: [
          ...audit.safetyWarnings,
          'The selected file could not be read while building the config diff preview.'
        ]
      }),
      settings: {}
    };
  }
}
