const REDACTED = '[REDACTED]';

const sensitiveAssignmentPattern = /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|SUPABASE|DISCORD|PRIVATE[_-]?KEY|BEARER)[A-Z0-9_-]*)\s*[:=]\s*("[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi;
const dotenvAssignmentPattern = /^(\s*(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=\s*)("[^"\n]*"|'[^'\n]*'|[^\n#]+)/gim;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const discordTokenPattern = /\b(?:mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,8}\.[A-Za-z0-9_-]{27,})\b/g;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const privateKeyPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const sshPrivateKeyPattern = /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g;
const genericApiKeyPattern = /\b(?:sk|pk|sb|ghp|github_pat|xoxb|xoxp|AIza)[A-Za-z0-9_./+=-]{16,}\b/g;
const urlPasswordPattern = /(\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)([^@\s/]+)(@)/gi;

export function redactSecrets(input: string): string {
  if (!input) {
    return input;
  }

  return input
    .replace(sshPrivateKeyPattern, REDACTED)
    .replace(privateKeyPattern, REDACTED)
    .replace(urlPasswordPattern, `$1${REDACTED}$3`)
    .replace(bearerPattern, `Bearer ${REDACTED}`)
    .replace(discordTokenPattern, REDACTED)
    .replace(jwtPattern, REDACTED)
    .replace(genericApiKeyPattern, REDACTED)
    .replace(sensitiveAssignmentPattern, `$1=${REDACTED}`)
    .replace(dotenvAssignmentPattern, `$1${REDACTED}`);
}

export function redactLines(lines: string[]): string[] {
  return lines.map((line) => redactSecrets(line));
}
