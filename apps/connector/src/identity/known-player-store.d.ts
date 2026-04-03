import { type IdentityConfidence, type KnownPlayerRecord } from '@gameops/shared';
interface UpsertKnownPlayerObservationInput {
    serverId: string;
    displayName: string;
    observedAt: string;
    source: string;
    confidence: IdentityConfidence;
    platformId?: string;
    playFabId?: string;
}
export declare function upsertKnownPlayerObservation(input: UpsertKnownPlayerObservationInput): void;
export declare function findKnownPlayer(serverId: string, displayName: string): KnownPlayerRecord | null;
export {};
//# sourceMappingURL=known-player-store.d.ts.map