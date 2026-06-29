import { timingSafeEqual } from 'node:crypto';

export type OperatorAuthStatus = 'allowed' | 'unauthorized' | 'misconfigured';

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getOperatorAuthStatus(params: {
  configuredKey: string | undefined;
  providedHeader: string | string[] | undefined;
  nodeEnv: string | undefined;
}): OperatorAuthStatus {
  const configuredKey = params.configuredKey?.trim();

  if (!configuredKey) {
    return params.nodeEnv === 'production' ? 'misconfigured' : 'allowed';
  }

  const providedKey = getHeaderValue(params.providedHeader);

  if (!providedKey) {
    return 'unauthorized';
  }

  return timingSafeStringEqual(providedKey, configuredKey) ? 'allowed' : 'unauthorized';
}
