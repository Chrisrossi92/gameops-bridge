import type { GameKey } from '@gameops/shared';
import { palworldAdapter } from './palworld/parser.js';
import { valheimAdapter } from './valheim/parser.js';
import type { GameLogAdapter } from './types.js';

export function getAdapter(game: GameKey): GameLogAdapter {
  if (game === 'valheim') {
    return valheimAdapter;
  }

  if (game === 'palworld') {
    return palworldAdapter;
  }

  throw new Error(`No adapter implemented yet for game: ${game}`);
}
