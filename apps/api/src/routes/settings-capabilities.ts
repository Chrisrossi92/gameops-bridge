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
import { getEventTemplateDraftCatalog, getObservedServerSettings, getServerSettingsCapabilitySummary, saveEventTemplateDraftCustomization } from '../services/settings-capabilities.js';

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

    return palworldConfigAuditSchema.parse(getPalworldConfigAudit(serverId));
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/palworld-backup-readiness', async (request, reply): Promise<PalworldBackupReadiness | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return palworldBackupReadinessSchema.parse(getPalworldBackupReadiness(serverId));
  });

  app.get<{ Params: { serverId: string } }>('/servers/:serverId/palworld-runtime-audit', async (request, reply): Promise<PalworldRuntimeAudit | { error: string }> => {
    const serverId = request.params.serverId.trim();

    if (!serverId) {
      reply.code(400);
      return { error: 'Invalid serverId' };
    }

    return palworldRuntimeAuditSchema.parse(getPalworldRuntimeAudit(serverId));
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
