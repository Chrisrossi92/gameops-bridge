import { eventTypeSchema } from '@gameops/shared';
import { z } from 'zod';
import { type ConfiguredServerMetadata } from './shared-config.js';
declare const routedEventTypeSchema: z.ZodEnum<{
    PLAYER_JOIN: "PLAYER_JOIN";
    PLAYER_LEAVE: "PLAYER_LEAVE";
    SERVER_ONLINE: "SERVER_ONLINE";
    SERVER_OFFLINE: "SERVER_OFFLINE";
    SERVER_RESTARTING: "SERVER_RESTARTING";
    HEALTH_WARN: "HEALTH_WARN";
    INCIDENT_OPENED: "INCIDENT_OPENED";
}>;
declare const localBotConfigSchema: z.ZodObject<{
    guildDefaults: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    channelGroups: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        activity: z.ZodString;
        alerts: z.ZodString;
    }, z.core.$strip>>>;
    eventRoutes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodEnum<{
        PLAYER_JOIN: "PLAYER_JOIN";
        PLAYER_LEAVE: "PLAYER_LEAVE";
        SERVER_ONLINE: "SERVER_ONLINE";
        SERVER_OFFLINE: "SERVER_OFFLINE";
        SERVER_RESTARTING: "SERVER_RESTARTING";
        HEALTH_WARN: "HEALTH_WARN";
        INCIDENT_OPENED: "INCIDENT_OPENED";
    }> & z.core.$partial, z.ZodString>>>;
    polling: z.ZodDefault<z.ZodObject<{
        intervalMs: z.ZodDefault<z.ZodNumber>;
        fetchLimit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RoutedEventType = z.infer<typeof routedEventTypeSchema>;
export type LocalBotConfig = z.infer<typeof localBotConfigSchema>;
export declare function getLocalBotConfig(): LocalBotConfig;
export declare function resolveDefaultServerId(guildId: string): string | null;
export declare function resolveEventChannelId(serverId: string, eventType: z.infer<typeof eventTypeSchema>): string | null;
export declare function getRoutedServerIds(): string[];
export declare function getPollingConfig(): {
    intervalMs: number;
    fetchLimit: number;
};
export declare function getKnownServerMetadata(serverId: string): ConfiguredServerMetadata | null;
export declare function getKnownServerIds(): string[];
export {};
//# sourceMappingURL=local-config.d.ts.map