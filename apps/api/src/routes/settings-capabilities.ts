import {
  eventTemplateDraftCatalogSchema,
  eventTemplateDraftOverrideRequestSchema,
  eventTemplateConfigDiffPreviewSchema,
  eventTemplateManualEditPlanSchema,
  observedSettingsResponseSchema,
  eventTemplateManualChangeChecklistSchema,
  palworldBackupReadinessSchema,
  palworldConfigAuditSchema,
  palworldRuntimeAuditSchema,
  serverSettingsCapabilitySummarySchema,
  type EventTemplateDraftCatalog,
  type EventTemplateConfigDiffPreview,
  type EventTemplateManualEditPlan,
  type EventTemplateDraftOverrideRequest,
  type EventTemplateManualChangeChecklist,
  type ObservedSettingsResponse,
  type PalworldBackupReadiness,
  type PalworldConfigAudit,
  type PalworldRuntimeAudit,
  type ServerSettingsCapabilitySummary
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import { getEventTemplateConfigDiffPreview } from '../services/event-template-config-diff-preview.js';
import { getEventTemplateManualEditPlan } from '../services/event-template-manual-edit-plan.js';
import { getEventTemplateManualChangeChecklist } from '../services/event-template-manual-change-checklist.js';
import { getPalworldBackupReadiness } from '../services/palworld-backup-readiness.js';
import { getPalworldConfigAudit } from '../services/palworld-config-audit.js';
import { getPalworldRuntimeAudit } from '../services/palworld-runtime-audit.js';
import { measureSync } from '../services/request-performance.js';
import { getEventTemplateDraftCatalog, getObservedServerSettings, getServerSettingsCapabilitySummary, saveEventTemplateDraftCustomization } from '../services/settings-capabilities.js';

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function degradedConfigAudit(serverId: string, reason: string): PalworldConfigAudit {
  return palworldConfigAuditSchema.parse({
    serverId,
    serverName: null,
    discoveryStatus: 'no_config_path',
    candidatePaths: [],
    selectedPath: null,
    canReadFile: false,
    parseStatus: 'not_attempted',
    parsedSettingCount: 0,
    matchedRestSettings: [],
    unmatchedFileSettings: [],
    unmatchedRestSettings: [],
    fileEditViability: 'unknown',
    safetyWarnings: [`Config audit degraded before completion: ${reason}`],
    nextValidationSteps: ['Retry the audit after the API has recovered.']
  });
}

function degradedBackupReadiness(serverId: string, reason: string): PalworldBackupReadiness {
  return palworldBackupReadinessSchema.parse({
    serverId,
    serverName: null,
    readinessStatus: 'unknown',
    filesToBackup: [],
    proposedBackupDirectory: null,
    proposedBackupFilenamePattern: null,
    activeRuntimeConfigPath: null,
    runtimeConfigMatchesSelected: false,
    runtimeAlignmentStatus: 'unknown',
    rollbackRequirements: [],
    validationSteps: ['Retry backup readiness after the API has recovered.'],
    safetyWarnings: [`Backup readiness degraded before completion: ${reason}`],
    canCreateBackup: false,
    reasonCreateBackupDisabled: 'Backup creation is not implemented. This endpoint only audits readiness.'
  });
}

function degradedRuntimeAudit(serverId: string, reason: string): PalworldRuntimeAudit {
  return palworldRuntimeAuditSchema.parse({
    serverId,
    servicePath: 'unknown',
    serviceReadable: false,
    workingDirectory: null,
    execStart: null,
    inferredActiveConfigPath: null,
    inferredActiveConfigExists: false,
    inferredActiveConfigReadable: false,
    selectedConfigAuditPath: null,
    pathsMatch: false,
    runtimeAuditStatus: 'unknown',
    summary: 'Runtime audit degraded before completion.',
    safetyWarnings: [reason]
  });
}

export async function registerSettingsCapabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { serverId: string } }>('/servers/:serverId/settings-capabilities', async (request, reply): Promise<ServerSettingsCapabilitySummary | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return serverSettingsCapabilitySummarySchema.parse(getServerSettingsCapabilitySummary(serverId));
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/settings-observed', async (request, reply): Promise<ObservedSettingsResponse | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return observedSettingsResponseSchema.parse(getObservedServerSettings(serverId));
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/palworld-config-audit', async (request, reply): Promise<PalworldConfigAudit | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    try {
      return measureSync('palworld-config-audit', () => palworldConfigAuditSchema.parse(getPalworldConfigAudit(serverId)));
    } catch (error) {
      const message = toMessage(error);
      request.log.warn(`[palworld-config-audit] degraded server=${serverId} reason=${message}`);
      return degradedConfigAudit(serverId, message);
    }
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/palworld-backup-readiness', async (request, reply): Promise<PalworldBackupReadiness | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    try {
      return measureSync('palworld-backup-readiness', () => palworldBackupReadinessSchema.parse(getPalworldBackupReadiness(serverId)));
    } catch (error) {
      const message = toMessage(error);
      request.log.warn(`[palworld-backup-readiness] degraded server=${serverId} reason=${message}`);
      return degradedBackupReadiness(serverId, message);
    }
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/palworld-runtime-audit', async (request, reply): Promise<PalworldRuntimeAudit | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    try {
      return measureSync('palworld-runtime-audit', () => palworldRuntimeAuditSchema.parse(getPalworldRuntimeAudit(serverId)));
    } catch (error) {
      const message = toMessage(error);
      request.log.warn(`[palworld-runtime-audit] degraded server=${serverId} reason=${message}`);
      return degradedRuntimeAudit(serverId, message);
    }
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/event-template-drafts', async (request, reply): Promise<EventTemplateDraftCatalog | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return eventTemplateDraftCatalogSchema.parse(getEventTemplateDraftCatalog(serverId));
  });

  app.get<{ Params: { serverId: string; templateId: string } }>('/servers/:serverId/event-template-drafts/:templateId/config-diff-preview', async (request, reply): Promise<EventTemplateConfigDiffPreview | { error: string }> => {
    const serverId = request.params.serverId.trim();
    const templateId = decodeURIComponent(request.params.templateId).trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    if (!templateId) {
      reply.code(400);
      return { error: 'Invalid templateId' };
    }

    const preview = getEventTemplateConfigDiffPreview(serverId, templateId);

    if (!preview) {
      reply.code(404);
      return { error: 'Event template draft not found' };
    }

    return eventTemplateConfigDiffPreviewSchema.parse(preview);
  });

  app.get<{ Params: { serverId: string; templateId: string } }>('/servers/:serverId/event-template-drafts/:templateId/manual-change-checklist', async (request, reply): Promise<EventTemplateManualChangeChecklist | { error: string }> => {
    const serverId = request.params.serverId.trim();
    const templateId = decodeURIComponent(request.params.templateId).trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    if (!templateId) {
      reply.code(400);
      return { error: 'Invalid templateId' };
    }

    const checklist = getEventTemplateManualChangeChecklist(serverId, templateId);

    if (!checklist) {
      reply.code(404);
      return { error: 'Event template draft not found' };
    }

    return eventTemplateManualChangeChecklistSchema.parse(checklist);
  });

  app.get<{ Params: { serverId: string; templateId: string } }>('/servers/:serverId/event-template-drafts/:templateId/manual-edit-plan', async (request, reply): Promise<EventTemplateManualEditPlan | { error: string }> => {
    const serverId = request.params.serverId.trim();
    const templateId = decodeURIComponent(request.params.templateId).trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    if (!templateId) {
      reply.code(400);
      return { error: 'Invalid templateId' };
    }

    const plan = getEventTemplateManualEditPlan(serverId, templateId);

    if (!plan) {
      reply.code(404);
      return { error: 'Event template draft not found' };
    }

    return eventTemplateManualEditPlanSchema.parse(plan);
  });

  app.put<{ Params: { serverId: string; templateId: string }; Body: EventTemplateDraftOverrideRequest }>('/servers/:serverId/event-template-drafts/:templateId', async (request, reply): Promise<EventTemplateDraftCatalog | { error: string }> => {
    const serverId = request.params.serverId.trim();
    const templateId = decodeURIComponent(request.params.templateId).trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    if (!templateId) {
      reply.code(400);
      return { error: 'Invalid templateId' };
    }

    const parsed = eventTemplateDraftOverrideRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid draft customization payload' };
    }

    const catalog = saveEventTemplateDraftCustomization({
      serverId,
      templateId,
      override: parsed.data
    });

    if (!catalog) {
      reply.code(404);
      return { error: 'Event template draft not found' };
    }

    return eventTemplateDraftCatalogSchema.parse(catalog);
  });
}
