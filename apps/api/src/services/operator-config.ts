import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

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

function readPathList(value: unknown): OperatorPathConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.label !== 'string' || typeof entry.path !== 'string') {
      return [];
    }

    const label = entry.label.trim();
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

  return {
    logPaths: readPathList(parsed.logPaths),
    projectRepos: readPathList(parsed.projectRepos),
    diskPaths: readPathList(parsed.diskPaths),
    healthChecks: readHealthChecks(parsed.healthChecks)
  };
}
