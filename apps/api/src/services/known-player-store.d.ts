import { type IdentityObservation, type KnownPlayerRecord } from '@gameops/shared';
export declare function getKnownPlayersForServer(serverId: string, limit?: number): KnownPlayerRecord[];
export declare function getKnownPlayerForServer(serverId: string, playerKeyOrName: string): KnownPlayerRecord | null;
export declare function getIdentityObservationsForPlayer(serverId: string, player: Pick<KnownPlayerRecord, 'normalizedPlayerKey' | 'displayName'>, limit?: number): IdentityObservation[];
//# sourceMappingURL=known-player-store.d.ts.map