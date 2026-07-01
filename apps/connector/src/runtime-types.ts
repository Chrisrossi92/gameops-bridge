import { z } from 'zod';

export const runtimeConnectorModeSchema = z.enum(['file', 'journal', 'rest', 'rcon', 'query']);
export type ConnectorMode = z.infer<typeof runtimeConnectorModeSchema>;
