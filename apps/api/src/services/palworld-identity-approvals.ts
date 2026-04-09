import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  palworldApprovedIdentitySchema,
  palworldIdentityApprovalsResponseSchema,
  palworldRejectedIdentitySchema,
  type PalworldApprovedIdentity,
  type PalworldIdentityApprovalsResponse,
  type PalworldRejectedIdentity
} from '@gameops/shared';
import { getPalworldIdentityLinkReview } from './palworld-identity-links.js';

function resolveApprovalsPath(): string {
  const rawPath = process.env.PALWORLD_APPROVED_IDENTITIES_PATH ?? '../approved-identities.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function loadApprovals(): PalworldIdentityApprovalsResponse {
  const path = resolveApprovalsPath();

  try {
    return palworldIdentityApprovalsResponseSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return palworldIdentityApprovalsResponseSchema.parse({
      approvals: [],
      rejections: []
    });
  }
}

function writeApprovals(payload: PalworldIdentityApprovalsResponse): void {
  const path = resolveApprovalsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function removeExistingReview(
  payload: PalworldIdentityApprovalsResponse,
  savePlayerSaveId: string,
  savePlayerFileName: string
): void {
  const normalizedSaveId = normalize(savePlayerSaveId);
  const normalizedFileName = normalize(savePlayerFileName);

  payload.approvals = payload.approvals.filter((entry) => (
    normalize(entry.savePlayerSaveId) !== normalizedSaveId
    && normalize(entry.savePlayerFileName) !== normalizedFileName
  ));
  payload.rejections = payload.rejections.filter((entry) => (
    normalize(entry.savePlayerSaveId) !== normalizedSaveId
    && normalize(entry.savePlayerFileName) !== normalizedFileName
  ));
}

export function listPalworldIdentityApprovals(): PalworldIdentityApprovalsResponse {
  return loadApprovals();
}

export function approvePalworldIdentity(input: {
  savePlayerKey: string;
  reviewedBy: string;
  notes?: string;
}): PalworldApprovedIdentity {
  const review = getPalworldIdentityLinkReview(input.savePlayerKey);

  if (!review.candidate) {
    throw new Error(`No candidate found for save player key "${input.savePlayerKey}"`);
  }

  const payload = loadApprovals();
  removeExistingReview(payload, review.candidate.savePlayerSaveId, review.candidate.savePlayerFileName);

  const approval = palworldApprovedIdentitySchema.parse({
    state: 'approved',
    serverId: review.candidate.serverId,
    savePlayerSaveId: review.candidate.savePlayerSaveId,
    savePlayerFileName: review.candidate.savePlayerFileName,
    telemetryLookupKey: review.candidate.telemetryLookupKey,
    playerId: review.candidate.candidate.playerId,
    userId: review.candidate.candidate.userId,
    accountName: review.candidate.candidate.accountName,
    playerName: review.candidate.candidate.playerName,
    approvedAt: new Date().toISOString(),
    approvedBy: input.reviewedBy,
    notes: input.notes ?? ''
  });

  payload.approvals.push(approval);
  writeApprovals(payload);
  return approval;
}

export function rejectPalworldIdentity(input: {
  savePlayerKey: string;
  reviewedBy: string;
  notes?: string;
}): PalworldRejectedIdentity {
  const review = getPalworldIdentityLinkReview(input.savePlayerKey);
  const failure = review.failures[0] ?? null;

  if (!review.candidate && !failure) {
    throw new Error(`No candidate or failure found for save player key "${input.savePlayerKey}"`);
  }

  const savePlayerSaveId = review.candidate?.savePlayerSaveId ?? failure?.savePlayerSaveId ?? input.savePlayerKey;
  const savePlayerFileName = review.candidate?.savePlayerFileName ?? failure?.savePlayerFileName ?? input.savePlayerKey;

  const payload = loadApprovals();
  removeExistingReview(payload, savePlayerSaveId, savePlayerFileName);

  const rejection = palworldRejectedIdentitySchema.parse({
    state: 'rejected',
    serverId: review.candidate?.serverId ?? null,
    savePlayerSaveId,
    savePlayerFileName,
    telemetryLookupKey: review.candidate?.telemetryLookupKey ?? null,
    playerId: review.candidate?.candidate.playerId ?? null,
    userId: review.candidate?.candidate.userId ?? null,
    accountName: review.candidate?.candidate.accountName ?? null,
    playerName: review.candidate?.candidate.playerName ?? null,
    rejectedAt: new Date().toISOString(),
    rejectedBy: input.reviewedBy,
    notes: input.notes ?? ''
  });

  payload.rejections.push(rejection);
  writeApprovals(payload);
  return rejection;
}
