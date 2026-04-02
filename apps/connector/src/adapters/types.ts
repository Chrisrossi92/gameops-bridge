import type { GameKey, NormalizedEvent } from '@gameops/shared';

export interface ParseContext {
  serverId: string;
}

export interface GameLogAdapter {
  game: GameKey;
  parseLine: (line: string, context: ParseContext) => NormalizedEvent | null;
}
