import { palworldAdapter } from './palworld/parser.js';
import { valheimAdapter } from './valheim/parser.js';
export function getAdapter(game) {
    if (game === 'valheim') {
        return valheimAdapter;
    }
    if (game === 'palworld') {
        return palworldAdapter;
    }
    throw new Error(`No adapter implemented yet for game: ${game}`);
}
//# sourceMappingURL=index.js.map