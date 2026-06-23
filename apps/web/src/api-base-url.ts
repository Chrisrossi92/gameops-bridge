export const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:3001';

export function resolveApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_LOCAL_API_BASE_URL;
}
