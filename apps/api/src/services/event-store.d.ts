import { type NormalizedEvent, type SessionRecord } from '@gameops/shared';
export declare function addEvents(events: NormalizedEvent[]): void;
export declare function getRecentEventsForServer(serverId: string, limit?: number): NormalizedEvent[];
export declare function getActiveSessionsForServer(serverId: string): SessionRecord[];
export declare function getRecentClosedSessionsForServer(serverId: string, limit?: number): SessionRecord[];
//# sourceMappingURL=event-store.d.ts.map