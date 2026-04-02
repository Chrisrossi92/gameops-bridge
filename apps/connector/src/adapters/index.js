import { valheimAdapter } from './valheim/parser.js';
export function getAdapter(game) {
    if (game === 'valheim') {
        return valheimAdapter;
    }
    throw new Error(`No adapter implemented yet for game: ${game}`);
}
//# sourceMappingURL=index.js.map