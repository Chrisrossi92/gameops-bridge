import { join, isAbsolute, resolve } from 'node:path';

export const PRODUCTION_DATA_DIR = '/srv/gameops-bridge/data';
export const LOCAL_DATA_DIR = './data';

export function getRuntimeDataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.GAMEOPS_DATA_DIR
    ?? (env.NODE_ENV === 'production' ? PRODUCTION_DATA_DIR : LOCAL_DATA_DIR);
}

export function resolveRuntimeDataPath(envName: string, fileName: string, env: NodeJS.ProcessEnv = process.env): string {
  const rawPath = env[envName] ?? join(getRuntimeDataDir(env), fileName);
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}
