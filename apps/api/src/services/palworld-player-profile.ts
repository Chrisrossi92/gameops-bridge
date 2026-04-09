import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  palworldUnifiedPlayerProfileSchema,
  type PalworldApprovedIdentity,
  type PalworldLatestPlayerTelemetry,
  type PalworldRejectedIdentity,
  type PalworldUnifiedPlayerProfile
} from '@gameops/shared';
import { z } from 'zod';
import { listPalworldIdentityApprovals } from './palworld-identity-approvals.js';
import { getLatestPalworldPlayerForServer } from './palworld-telemetry-store.js';

const rawPlayerFileSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  modifiedAt: z.string().datetime(),
  exists: z.boolean(),
  playerFileName: z.string().min(1),
  playerSaveId: z.string().min(1),
  parseStatus: z.object({
    status: z.string().min(1)
  }).passthrough()
}).passthrough();

const rawPlayersSummarySchema = z.object({
  playerFiles: z.array(rawPlayerFileSchema).default([])
});

function resolvePlayersSummaryPath(): string {
  const rawPath = process.env.PALWORLD_PLAYERS_SUMMARY_PATH ?? '../players-summary.json';
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function loadPlayersSummary(): z.infer<typeof rawPlayersSummarySchema> {
  const path = resolvePlayersSummaryPath();

  try {
    return rawPlayersSummarySchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return rawPlayersSummarySchema.parse({});
  }
}

function findMatchingReviewRecord(
  serverId: string,
  telemetry: PalworldLatestPlayerTelemetry
): PalworldApprovedIdentity | PalworldRejectedIdentity | null {
  const approvals = listPalworldIdentityApprovals();
  const matchTargets = [
    telemetry.lookupKey,
    telemetry.playerId ?? '',
    telemetry.userId ?? '',
    telemetry.accountName ?? '',
    telemetry.playerName ?? ''
  ].map(normalize).filter(Boolean);

  const reviewRecords = [
    ...approvals.approvals.filter((entry) => entry.serverId === serverId),
    ...approvals.rejections.filter((entry) => entry.serverId === serverId || entry.serverId === null)
  ];

  return reviewRecords.find((entry) => {
    const entryTargets = [
      entry.telemetryLookupKey ?? '',
      entry.playerId ?? '',
      entry.userId ?? '',
      entry.accountName ?? '',
      entry.playerName ?? ''
    ].map(normalize).filter(Boolean);

    return entryTargets.some((target) => matchTargets.includes(target));
  }) ?? null;
}

function findSaveArtifact(
  telemetry: PalworldLatestPlayerTelemetry,
  reviewRecord: PalworldApprovedIdentity | PalworldRejectedIdentity | null
): {
  present: boolean;
  path: string | null;
  modifiedAt: string | null;
  sizeBytes: number | null;
  parseStatus: string | null;
  savePlayerSaveId: string | null;
  savePlayerFileName: string | null;
} {
  const summary = loadPlayersSummary();
  const preferredKeys = [
    reviewRecord?.savePlayerSaveId ?? '',
    reviewRecord?.savePlayerFileName ?? '',
    telemetry.playerId ?? ''
  ].map(normalize).filter(Boolean);

  const matched = summary.playerFiles.find((entry) => {
    const entryKeys = [entry.playerSaveId, entry.playerFileName].map(normalize);
    return entryKeys.some((key) => preferredKeys.includes(key));
  }) ?? null;

  if (!matched) {
    return {
      present: false,
      path: null,
      modifiedAt: null,
      sizeBytes: null,
      parseStatus: null,
      savePlayerSaveId: reviewRecord?.savePlayerSaveId ?? null,
      savePlayerFileName: reviewRecord?.savePlayerFileName ?? null
    };
  }

  return {
    present: matched.exists,
    path: matched.path,
    modifiedAt: matched.modifiedAt,
    sizeBytes: matched.sizeBytes,
    parseStatus: matched.parseStatus.status,
    savePlayerSaveId: matched.playerSaveId,
    savePlayerFileName: matched.playerFileName
  };
}

function toReviewMetadata(reviewRecord: PalworldApprovedIdentity | PalworldRejectedIdentity | null): {
  state: 'approved' | 'rejected' | 'unresolved';
  savePlayerSaveId: string | null;
  savePlayerFileName: string | null;
  telemetryLookupKey: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string;
} {
  if (!reviewRecord) {
    return {
      state: 'unresolved',
      savePlayerSaveId: null,
      savePlayerFileName: null,
      telemetryLookupKey: null,
      reviewedAt: null,
      reviewedBy: null,
      notes: ''
    };
  }

  if (reviewRecord.state === 'approved') {
    return {
      state: 'approved',
      savePlayerSaveId: reviewRecord.savePlayerSaveId,
      savePlayerFileName: reviewRecord.savePlayerFileName,
      telemetryLookupKey: reviewRecord.telemetryLookupKey,
      reviewedAt: reviewRecord.approvedAt,
      reviewedBy: reviewRecord.approvedBy,
      notes: reviewRecord.notes
    };
  }

  return {
    state: 'rejected',
    savePlayerSaveId: reviewRecord.savePlayerSaveId,
    savePlayerFileName: reviewRecord.savePlayerFileName,
    telemetryLookupKey: reviewRecord.telemetryLookupKey,
    reviewedAt: reviewRecord.rejectedAt,
    reviewedBy: reviewRecord.rejectedBy,
    notes: reviewRecord.notes
  };
}

export function getPalworldUnifiedPlayerProfile(serverId: string, playerId: string): PalworldUnifiedPlayerProfile | null {
  const telemetry = getLatestPalworldPlayerForServer(serverId, playerId);

  if (!telemetry) {
    return null;
  }

  const reviewRecord = findMatchingReviewRecord(serverId, telemetry);
  const review = toReviewMetadata(reviewRecord);
  const saveArtifact = findSaveArtifact(telemetry, reviewRecord);

  return palworldUnifiedPlayerProfileSchema.parse({
    serverId,
    playerId: telemetry.playerId ?? playerId,
    lookupKey: telemetry.lookupKey,
    playerName: telemetry.playerName ?? null,
    accountName: telemetry.accountName ?? null,
    userId: telemetry.userId ?? null,
    level: telemetry.level ?? null,
    ping: telemetry.ping ?? null,
    locationX: telemetry.locationX ?? null,
    locationY: telemetry.locationY ?? null,
    region: telemetry.region ?? null,
    firstSeenAt: telemetry.firstSeenAt ?? null,
    lastSeenAt: telemetry.lastSeenAt ?? null,
    maxLevelSeen: telemetry.maxLevelSeen ?? null,
    totalSessions: telemetry.totalSessions ?? null,
    isOnline: telemetry.isOnline,
    avgPing: telemetry.avgPing ?? null,
    maxPing: telemetry.maxPing ?? null,
    pingStdDev: telemetry.pingStdDev ?? null,
    currentSessionDurationSeconds: telemetry.currentSessionDurationSeconds ?? null,
    identityState: review.state,
    review,
    saveArtifact
  });
}
