import { eventTypeSchema } from '@gameops/shared';
import { z } from 'zod';
declare const routedEventTypeSchema: z.ZodEnum<{
    PLAYER_JOIN: "PLAYER_JOIN";
    PLAYER_LEAVE: "PLAYER_LEAVE";
    SERVER_ONLINE: "SERVER_ONLINE";
    HEALTH_WARN: "HEALTH_WARN";
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
        HEALTH_WARN: "HEALTH_WARN";
    }>, z.ZodString>>>;
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
export {};
//# sourceMappingURL=local-config.d.ts.map