import type { NormalizedEvent } from '@gameops/shared';
import { type Client } from 'discord.js';
export declare function postRoutedEvent(client: Client, event: NormalizedEvent): Promise<boolean>;
export declare function postRoutedBurstSummary(client: Client, serverId: string, eventType: 'PLAYER_JOIN' | 'PLAYER_LEAVE', events: NormalizedEvent[]): Promise<boolean>;
//# sourceMappingURL=event-poster.d.ts.map