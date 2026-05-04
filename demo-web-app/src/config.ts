import path from 'node:path';
import type { DemoConfig } from './types';
import { readNumber } from './validation';

export const loadDemoConfig = (
  env: Record<string, string | undefined> = process.env
): DemoConfig => {
  const cwd = process.cwd();

  const configuredDataDir = env.DEMO_DATA_DIR ?? './demo-web-app/data';

  return {
    host: env.DEMO_HOST ?? '127.0.0.1',
    port: readNumber(env.DEMO_PORT, 3010, { min: 0, max: 65_535 }),
    dataDir: path.isAbsolute(configuredDataDir)
      ? configuredDataDir
      : path.resolve(cwd, configuredDataDir),
    queueName: env.DEMO_QUEUE_NAME ?? 'demo.task.jobs',
    tokenTtlMs: readNumber(env.DEMO_TOKEN_TTL_MS, 3_600_000, { min: 60_000 }),
    workerPollMs: readNumber(env.DEMO_WORKER_POLL_MS, 250, { min: 25 })
  };
};
