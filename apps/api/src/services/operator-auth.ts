import { timingSafeEqual } from 'node:crypto';

export type OperatorAuthStatus = 'allowed' | 'unauthorized' | 'misconfigured';
export type DashboardOperatorAccessStatus = 'allowed' | 'unavailable';
export type OperatorKeyState = 'missing' | 'blank' | 'configured';
export type OperatorHeaderState = 'missing' | 'blank' | 'provided';

export interface OperatorAuthDiagnostics {
  nodeEnv: string;
  configuredKeyState: OperatorKeyState;
  providedHeaderState: OperatorHeaderState;
}

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

function getOperatorKeyState(value: string | undefined): OperatorKeyState {
  if (value === undefined) {
    return 'missing';
  }

  return value.trim() ? 'configured' : 'blank';
}

function getOperatorHeaderState(value: string | string[] | undefined): OperatorHeaderState {
  if (value === undefined) {
    return 'missing';
  }

  return getHeaderValue(value) ? 'provided' : 'blank';
}

export function getOperatorAuthDiagnostics(params: {
  configuredKey: string | undefined;
  providedHeader: string | string[] | undefined;
  nodeEnv: string | undefined;
}): OperatorAuthDiagnostics {
  return {
    nodeEnv: params.nodeEnv ?? 'undefined',
    configuredKeyState: getOperatorKeyState(params.configuredKey),
    providedHeaderState: getOperatorHeaderState(params.providedHeader)
  };
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

function parseOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getHeaderOrigin(value: string | string[] | undefined): string | null {
  return parseOrigin(getHeaderValue(value));
}

function getRefererOrigin(value: string | string[] | undefined): string | null {
  return parseOrigin(getHeaderValue(value));
}

export function getDashboardOperatorAccessStatus(params: {
  headers: { [key: string]: string | string[] | undefined };
  nodeEnv: string | undefined;
  allowedOrigins: true | string[];
}): DashboardOperatorAccessStatus {
  if (params.nodeEnv !== 'production') {
    return 'allowed';
  }

  if (params.allowedOrigins === true) {
    return 'unavailable';
  }

  const requestOrigin = getHeaderOrigin(params.headers.origin) ?? getRefererOrigin(params.headers.referer);

  if (!requestOrigin) {
    return 'unavailable';
  }

  return params.allowedOrigins.includes(requestOrigin) ? 'allowed' : 'unavailable';
}
