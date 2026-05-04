import { createDemoWebApp } from './app';

const run = async (): Promise<void> => {
  const app = createDemoWebApp();
  const started = await app.start();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[demo-web-app] ${signal} received, shutting down...`);
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  console.log(`[demo-web-app] running at ${started.baseUrl}`);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`[demo-web-app] startup failed: ${message}`);
  process.exit(1);
});
