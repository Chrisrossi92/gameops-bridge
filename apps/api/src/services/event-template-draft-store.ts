import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { eventTemplateDraftOverrideRequestSchema, type EventTemplateDraftOverrideRequest } from '@gameops/shared';
import { z } from 'zod';
import { resolveRuntimeDataPath } from './runtime-paths.js';

const eventTemplateDraftOverrideRecordSchema = eventTemplateDraftOverrideRequestSchema.extend({
  serverId: z.string().min(1),
  templateId: z.string().min(1),
  enabledInDashboard: z.boolean().default(true),
  displayName: z.string().min(1).nullable().default(null),
  targetMultiplier: z.number().positive().max(1000).nullable().default(null),
  targetValue: z.union([z.string(), z.number(), z.boolean()]).nullable().default(null),
  durationHours: z.number().positive().max(24 * 30).nullable().default(null),
  notes: z.string().nullable().default(null),
  scheduleLabel: z.string().nullable().default(null),
  updatedAt: z.string().datetime()
});

const eventTemplateDraftStoreSchema = z.object({
  overrides: z.array(eventTemplateDraftOverrideRecordSchema).default([])
});

export type EventTemplateDraftOverrideRecord = z.infer<typeof eventTemplateDraftOverrideRecordSchema>;

function resolveStorePath(): string {
  return resolveRuntimeDataPath('EVENT_TEMPLATE_DRAFT_STORE_PATH', 'event-template-drafts.json');
}

function loadStore(): z.infer<typeof eventTemplateDraftStoreSchema> {
  const path = resolveStorePath();

  try {
    return eventTemplateDraftStoreSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return eventTemplateDraftStoreSchema.parse({});
  }
}

function writeStore(store: z.infer<typeof eventTemplateDraftStoreSchema>): void {
  const path = resolveStorePath();

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.log(`[event-template-draft-store] persist-failed path=${path} error=${message}`);
  }
}

export function getEventTemplateDraftOverridesForServer(serverId: string): EventTemplateDraftOverrideRecord[] {
  return loadStore().overrides
    .filter((override) => override.serverId === serverId)
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}

export function getEventTemplateDraftOverride(serverId: string, templateId: string): EventTemplateDraftOverrideRecord | null {
  return getEventTemplateDraftOverridesForServer(serverId)
    .find((override) => override.templateId === templateId) ?? null;
}

export function saveEventTemplateDraftOverride(input: {
  serverId: string;
  templateId: string;
  override: EventTemplateDraftOverrideRequest;
  now?: Date;
}): EventTemplateDraftOverrideRecord {
  const store = loadStore();
  const existingIndex = store.overrides.findIndex((override) => (
    override.serverId === input.serverId && override.templateId === input.templateId
  ));
  const existing = existingIndex >= 0 ? store.overrides[existingIndex] : null;
  const saved = eventTemplateDraftOverrideRecordSchema.parse({
    serverId: input.serverId,
    templateId: input.templateId,
    enabledInDashboard: input.override.enabledInDashboard ?? existing?.enabledInDashboard ?? true,
    displayName: input.override.displayName === undefined ? existing?.displayName ?? null : input.override.displayName,
    targetMultiplier: input.override.targetMultiplier === undefined ? existing?.targetMultiplier ?? null : input.override.targetMultiplier,
    targetValue: input.override.targetValue === undefined ? existing?.targetValue ?? null : input.override.targetValue,
    durationHours: input.override.durationHours === undefined ? existing?.durationHours ?? null : input.override.durationHours,
    notes: input.override.notes === undefined ? existing?.notes ?? null : input.override.notes,
    scheduleLabel: input.override.scheduleLabel === undefined ? existing?.scheduleLabel ?? null : input.override.scheduleLabel,
    updatedAt: (input.now ?? new Date()).toISOString()
  });

  if (existingIndex >= 0) {
    store.overrides[existingIndex] = saved;
  } else {
    store.overrides.push(saved);
  }

  store.overrides.sort((left, right) => (
    left.serverId.localeCompare(right.serverId) || left.templateId.localeCompare(right.templateId)
  ));
  writeStore(store);
  return saved;
}

export function resetEventTemplateDraftStoreForTests(): void {
  writeStore(eventTemplateDraftStoreSchema.parse({}));
}
