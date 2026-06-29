import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';

export interface OperatorPathConfig {
  label: string;
  path: string;
}

export interface OperatorHealthCheckConfig {
  label: string;
  url: string;
}

export interface OperatorConfig {
  logPaths: OperatorPathConfig[];
  projectRepos: OperatorPathConfig[];
  diskPaths: OperatorPathConfig[];
  healthChecks: OperatorHealthCheckConfig[];
  configWarnings?: string[];
}

const emptyConfig: OperatorConfig = {
  logPaths: [],
  projectRepos: [],
  diskPaths: [],
  healthChecks: []
};

function resolveOperatorConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const rawPath = env.GAMEOPS_OPERATOR_CONFIG_PATH ?? './config/operator.local.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function labelFromPath(path: string): string {
  return basename(path) || path;
}

function readPathList(value: unknown, fieldName: string, warnings: string[]): OperatorPathConfig[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) {
      warnings.push(`Operator config field "${fieldName}" must be an array.`);
    }

    return [];
  }

  return value.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      const path = entry.trim();
      return path ? [{ label: labelFromPath(path), path }] : [];
    }

    if (!isRecord(entry) || (typeof entry.label !== 'string' && typeof entry.name !== 'string') || typeof entry.path !== 'string') {
      warnings.push(`Operator config field "${fieldName}" entry ${index + 1} must include label and path.`);
      return [];
    }

    const labelRaw = typeof entry.label === 'string' ? entry.label : entry.name;
    const label = typeof labelRaw === 'string' ? labelRaw.trim() : '';
    const path = entry.path.trim();

    return label && path ? [{ label, path }] : [];
  });
}

function readHealthChecks(value: unknown): OperatorHealthCheckConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.label !== 'string' || typeof entry.url !== 'string') {
      return [];
    }

    const label = entry.label.trim();
    const url = entry.url.trim();

    return label && url ? [{ label, url }] : [];
  });
}

export function loadOperatorConfig(env: NodeJS.ProcessEnv = process.env): OperatorConfig {
  const configPath = resolveOperatorConfigPath(env);

  if (!existsSync(configPath)) {
    return emptyConfig;
  }

  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!isRecord(parsed)) {
    return emptyConfig;
  }

  const configWarnings: string[] = [];
  const projectRepoFields = [
    'projectRepos',
    'repoPaths',
    'repos',
    'repositories',
    'gitRepos'
  ];
  const configuredProjectRepoField = projectRepoFields.find((field) => Array.isArray(parsed[field]));
  const ignoredProjectRepoFields = projectRepoFields.filter((field) => (
    field !== configuredProjectRepoField && parsed[field] !== undefined
  ));

  if (configuredProjectRepoField && configuredProjectRepoField !== 'projectRepos') {
    configWarnings.push(`Operator config field "${configuredProjectRepoField}" is supported as a repo-path alias; prefer "projectRepos".`);
  }

  for (const field of ignoredProjectRepoFields) {
    configWarnings.push(`Operator config field "${field}" was ignored because "${configuredProjectRepoField ?? 'projectRepos'}" is being used for repo paths.`);
  }

  if (!configuredProjectRepoField && projectRepoFields.some((field) => parsed[field] !== undefined)) {
    configWarnings.push('Operator repo path fields were present but none were valid arrays.');
  }

  return {
    logPaths: readPathList(parsed.logPaths, 'logPaths', configWarnings),
    projectRepos: readPathList(parsed[configuredProjectRepoField ?? 'projectRepos'], configuredProjectRepoField ?? 'projectRepos', configWarnings),
    diskPaths: readPathList(parsed.diskPaths, 'diskPaths', configWarnings),
    healthChecks: readHealthChecks(parsed.healthChecks),
    configWarnings
  };
}
