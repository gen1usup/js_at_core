import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const externalBaseURL = process.env.BASE_URL ?? process.env.AP_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:3010';

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
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  };
}

export default defineConfig(config);
