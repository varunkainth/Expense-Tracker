import { buildApp } from './app';
import { readEnv } from './config/env';
const env = readEnv();
const app = buildApp(env);
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
}
try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ event: 'relay_ready', logLevel: env.LOG_LEVEL, expenseTransfer: 'workspace-v2-chunked', persistence: 'temporary-memory' }, 'Relay ready. Pairing and transfer stages log at info; LOG_LEVEL=debug also logs HTTP requests.');
}
catch (error) {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
}
