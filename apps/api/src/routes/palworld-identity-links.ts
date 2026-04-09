import {
  palworldIdentityLinkReviewResponseSchema,
  palworldIdentityLinksResponseSchema,
  type PalworldIdentityLinkReviewResponse,
  type PalworldIdentityLinksResponse
} from '@gameops/shared';
import type { FastifyInstance } from 'fastify';
import {
  getPalworldIdentityLinkCandidates,
  getPalworldIdentityLinkFailures,
  getPalworldIdentityLinkReview
} from '../services/palworld-identity-links.js';

export async function registerPalworldIdentityLinkRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>(
    '/palworld/identity-links',
    async (request): Promise<PalworldIdentityLinksResponse> => {
      const parsedLimit = Number(request.query.limit);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;

      return palworldIdentityLinksResponseSchema.parse({
        candidates: getPalworldIdentityLinkCandidates(limit),
        failures: getPalworldIdentityLinkFailures(limit)
      });
    }
  );

  app.get<{ Params: { savePlayerKey: string } }>(
    '/palworld/identity-links/:savePlayerKey',
    async (request): Promise<PalworldIdentityLinkReviewResponse | { error: string }> => {
      const savePlayerKey = decodeURIComponent(request.params.savePlayerKey).trim();

      if (!savePlayerKey) {
        return { error: 'Invalid savePlayerKey' };
      }

      return palworldIdentityLinkReviewResponseSchema.parse(
        getPalworldIdentityLinkReview(savePlayerKey)
      );
    }
  );
}
