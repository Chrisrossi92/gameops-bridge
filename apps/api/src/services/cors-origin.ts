import { loadGameOpsConfig } from './server-config.js';

const DEFAULT_PUBLIC_DASHBOARD_ORIGIN = 'https://servers.cdawgbot.xyz';

function splitOrigins(value: string | undefined): string[] {
  return value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? [];
}

function getConfiguredCorsOrigin(): string | undefined {
  try {
    return loadGameOpsConfig().api.corsOrigin;
  } catch {
    return undefined;
  }
}

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env, configuredCorsOrigin = getConfiguredCorsOrigin()): true | string[] {
  const explicitOrigins = [
    ...splitOrigins(env.API_CORS_ORIGIN),
    ...splitOrigins(env.CORS_ORIGIN)
  ];

  if (explicitOrigins.length > 0) {
    return Array.from(new Set(explicitOrigins));
  }

  const configuredOrigins = splitOrigins(configuredCorsOrigin);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (env.NODE_ENV === 'production') {
    return [DEFAULT_PUBLIC_DASHBOARD_ORIGIN];
  }

  return true;
}
