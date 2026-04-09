import {
  palworldApprovedIdentitySchema,
  palworldIdentityApprovalActionSchema,
  palworldIdentityApprovalsResponseSchema,
  palworldRejectedIdentitySchema,
  type PalworldApprovedIdentity,
  type PalworldIdentityApprovalAction,
  type PalworldIdentityApprovalsResponse,
  type PalworldRejectedIdentity
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import {
  approvePalworldIdentity,
  listPalworldIdentityApprovals,
  rejectPalworldIdentity
} from '../services/palworld-identity-approvals.js';

export async function registerPalworldIdentityApprovalRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/palworld/identity-approvals',
    async (): Promise<PalworldIdentityApprovalsResponse> => {
      return palworldIdentityApprovalsResponseSchema.parse(listPalworldIdentityApprovals());
    }
  );

  app.post<{ Body: PalworldIdentityApprovalAction }>(
    '/palworld/identity-approvals/approve',
    async (request, reply): Promise<PalworldApprovedIdentity | { error: string }> => {
      const parsed = palworldIdentityApprovalActionSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return { error: 'Invalid approval payload' };
      }

      try {
        return palworldApprovedIdentitySchema.parse(approvePalworldIdentity({
          savePlayerKey: parsed.data.savePlayerKey,
          reviewedBy: parsed.data.reviewedBy,
          notes: parsed.data.notes
        }));
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  app.post<{ Body: PalworldIdentityApprovalAction }>(
    '/palworld/identity-approvals/reject',
    async (request, reply): Promise<PalworldRejectedIdentity | { error: string }> => {
      const parsed = palworldIdentityApprovalActionSchema.safeParse(request.body);

      if (!parsed.success) {
        reply.code(400);
        return { error: 'Invalid rejection payload' };
      }

      try {
        return palworldRejectedIdentitySchema.parse(rejectPalworldIdentity({
          savePlayerKey: parsed.data.savePlayerKey,
          reviewedBy: parsed.data.reviewedBy,
          notes: parsed.data.notes
        }));
      } catch (error) {
        reply.code(404);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }
  );
}
