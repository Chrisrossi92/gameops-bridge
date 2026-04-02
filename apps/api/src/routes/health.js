export async function registerHealthRoute(app) {
    app.get('/health', async () => {
        return {
            ok: true,
            service: 'api',
            timestamp: new Date().toISOString()
        };
    });
}
//# sourceMappingURL=health.js.map