import type { ProjectAdapter } from '@automation-platform/contracts';
import { TemplateAuthProvider } from './auth-provider';
import { templateRoutes } from './routes';
import { templateSelectorRegistry } from './selectors';

export const templateProjectAdapter: ProjectAdapter = {
  name: 'template-webapp',
  version: '1.0.0',
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
  },
  featureFlags: {
    queueVerification: true,
    strictEntityValidation: true
  },
  routes: templateRoutes,
  selectors: templateSelectorRegistry,
  authProvider: new TemplateAuthProvider(),
  async initialize(context) {
    context.logger.info('Template project adapter initialized', {
      projectName: context.projectName,
      executionId: context.executionId
    });
  },
  async dispose(context) {
    context.logger.info('Template project adapter disposed', {
      executionId: context.executionId
    });
  }
};
