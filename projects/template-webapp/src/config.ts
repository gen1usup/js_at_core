import type { PlatformConfig } from '@automation-platform/config';

export const templateProjectConfigOverride: Partial<PlatformConfig> = {
  projectName: 'template-webapp',
  featureFlags: {
    queueVerification: true,
    seededData: true
  },
  capabilities: {
    ui: true,
    api: true,
    db: true,
    queue: true,
    screenshots: true,
    networkCapture: true,
    consoleCapture: true,
    fileUpload: true,
    downloadHandling: true,
    multiTab: true,
    authViaApi: true,
    authViaUi: true,
    diagnostics: true,
    cleanup: true,
    plugins: true
  }
};
