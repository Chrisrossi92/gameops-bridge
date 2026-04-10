import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  palworldManualTransitionPostResponseSchema,
  type PalworldManualTransitionPostAction,
  type PalworldManualTransitionPostResponse,
  type PalworldTransitionMilestoneEvent
} from '@gameops/shared';
import { z } from 'zod';
import { getRecentPalworldMilestoneTransitionEventsForServer } from './palworld-milestone-transition-store.js';

const localBotConfigSchema = z.object({
  eventRoutes: z.record(
    z.string(),
    z.object({
      PLAYER_JOIN: z.string().min(1).optional()
    }).passthrough()
  ).default({})
});

function resolveBotConfigPath(): string {
  const configured = process.env.BOT_LOCAL_CONFIG_PATH;

  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  const candidatePaths = [
    resolve(process.cwd(), './apps/bot/config/bot.local.json'),
    resolve(process.cwd(), './config/bot.local.json')
  ];

  for (const path of candidatePaths) {
    try {
      readFileSync(path, 'utf8');
      return path;
    } catch {
      continue;
    }
  }

  return candidatePaths[0]!;
}

function resolvePalworldActivityChannelId(serverId: string): string {
  const path = resolveBotConfigPath();
  const parsed = localBotConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  const channelId = parsed.eventRoutes[serverId]?.PLAYER_JOIN ?? '';

  if (!channelId || channelId.startsWith('REPLACE_')) {
    throw new Error(`No Palworld activity channel configured for server "${serverId}"`);
  }

  return channelId;
}

function findTransitionEvent(input: PalworldManualTransitionPostAction): PalworldTransitionMilestoneEvent {
  const events = getRecentPalworldMilestoneTransitionEventsForServer(input.serverId, 500);
  const matched = events.find((event) => (
    event.playerId === input.playerId
    && event.eventType === input.eventType
    && event.occurredAt === input.occurredAt
    && (event.fromValue ?? null) === (input.fromValue ?? null)
    && (event.toValue ?? null) === (input.toValue ?? null)
  )) ?? null;

  if (!matched) {
    throw new Error('Transition event not found');
  }

  return matched;
}

export async function postPalworldTransitionPreviewToDiscord(
  input: PalworldManualTransitionPostAction
): Promise<PalworldManualTransitionPostResponse> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error('Missing DISCORD_BOT_TOKEN');
  }

  const event = findTransitionEvent(input);
  const channelId = resolvePalworldActivityChannelId(input.serverId);

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: event.previewMessage
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? `Discord post failed with status ${response.status}`);
  }

  return palworldManualTransitionPostResponseSchema.parse({
    ok: true,
    channelId,
    messagePreview: event.previewMessage
  });
}
