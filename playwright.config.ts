import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const externalBaseURL = process.env.BASE_URL ?? process.env.AP_BASE_URL;
const demoHost = '127.0.0.1';
const demoPort = '3010';
const demoBaseURL = `http://${demoHost}:${demoPort}`;
const baseURL = externalBaseURL ?? demoBaseURL;

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
};

if (process.env.CI) {
  config.workers = 2;
}

if (!externalBaseURL) {
  config.webServer = {
    command: 'npx tsx demo-web-app/src/server.ts',
    url: demoBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      DEMO_HOST: demoHost,
      DEMO_PORT: demoPort,
      DEMO_DATA_DIR: 'artifacts/demo-e2e-data'
    }
  };
}

export default defineConfig(config);
