import { normalizedEventSchema } from '@gameops/shared';
function splitTimestampAndMessage(line) {
    const timestampMatch = /^\[(.+?)\]\s*(.*)$/.exec(line);
    if (!timestampMatch) {
        return {
            occurredAt: new Date().toISOString(),
            message: line.trim()
        };
    }
    const timestamp = timestampMatch[1] ?? '';
    const rawMessage = timestampMatch[2] ?? '';
    const parsedDate = new Date(timestamp);
    return {
        occurredAt: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
        message: rawMessage.trim()
    };
}
function createEvent(input) {
    return normalizedEventSchema.parse({
        ...input,
        game: 'valheim'
    });
}
function extractPlayerName(message, pattern) {
    const match = pattern.exec(message);
    if (!match) {
        return null;
    }
    const captured = match[1]?.trim();
    if (!captured) {
        return null;
    }
    // Strip trailing metadata segments that often appear in journal lines.
    return captured.replace(/\s+\(.*\)$/, '').replace(/\s+\[.*\]$/, '');
}
export const valheimAdapter = {
    game: 'valheim',
    parseLine(line, context) {
        const { occurredAt, message } = splitTimestampAndMessage(line);
        if (!message) {
            return null;
        }
        if (/game server connected|server started|server online/i.test(message)) {
            return createEvent({
                serverId: context.serverId,
                eventType: 'SERVER_ONLINE',
                occurredAt,
                message
            });
        }
        const joinedPlayerName = extractPlayerName(message, /player joined(?::\s*|\s+server\s+)(.+)$/i);
        if (joinedPlayerName) {
            return createEvent({
                serverId: context.serverId,
                eventType: 'PLAYER_JOIN',
                playerName: joinedPlayerName,
                occurredAt,
                message
            });
        }
        const leftPlayerName = extractPlayerName(message, /(?:player left:\s*|player connection lost server\s+)(.+)$/i);
        if (leftPlayerName) {
            return createEvent({
                serverId: context.serverId,
                eventType: 'PLAYER_LEAVE',
                playerName: leftPlayerName,
                occurredAt,
                message
            });
        }
        if (/(warning|error|exception)/i.test(message)) {
            return createEvent({
                serverId: context.serverId,
                eventType: 'HEALTH_WARN',
                occurredAt,
                message
            });
        }
        return null;
    }
};
//# sourceMappingURL=parser.js.map