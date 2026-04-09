import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  palworldIdentityLinksResponseSchema,
  type PalworldIdentityLinkCandidate,
  type PalworldIdentityLinkFailure,
  type PalworldIdentityLinksResponse
} from '@gameops/shared';

function resolveIdentityLinksPath(): string {
  const rawPath = process.env.PALWORLD_IDENTITY_LINKS_PATH ?? '../identity-links.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function loadIdentityLinks(): PalworldIdentityLinksResponse {
  const path = resolveIdentityLinksPath();

  try {
    return palworldIdentityLinksResponseSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return palworldIdentityLinksResponseSchema.parse({
      candidates: [],
      failures: []
    });
  }
}

export function getPalworldIdentityLinkCandidates(limit = 100): PalworldIdentityLinkCandidate[] {
  return loadIdentityLinks().candidates
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit));
}

export function getPalworldIdentityLinkFailures(limit = 100): PalworldIdentityLinkFailure[] {
  return loadIdentityLinks().failures.slice(0, Math.max(1, limit));
}

export function getPalworldIdentityLinkReview(savePlayerKey: string): {
  candidate: PalworldIdentityLinkCandidate | null;
  failures: PalworldIdentityLinkFailure[];
} {
  const normalizedKey = normalize(savePlayerKey);

  if (!normalizedKey) {
    return { candidate: null, failures: [] };
  }

  const links = loadIdentityLinks();
  const candidate = links.candidates.find((entry) => (
    normalize(entry.savePlayerSaveId) === normalizedKey
    || normalize(entry.savePlayerFileName) === normalizedKey
  )) ?? null;
  const failures = links.failures.filter((entry) => (
    normalize(entry.savePlayerSaveId) === normalizedKey
    || normalize(entry.savePlayerFileName) === normalizedKey
  ));

  return { candidate, failures };
}
