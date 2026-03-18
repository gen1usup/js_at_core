import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const alias = {
  '@automation-platform/contracts': path.resolve(__dirname, 'packages/contracts/src/index.ts'),
  '@automation-platform/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
  '@automation-platform/logger': path.resolve(__dirname, 'packages/logger/src/index.ts'),
  '@automation-platform/utils': path.resolve(__dirname, 'packages/utils/src/index.ts'),
  '@automation-platform/metadata': path.resolve(__dirname, 'packages/metadata/src/index.ts'),
  '@automation-platform/execution': path.resolve(__dirname, 'packages/execution/src/index.ts'),
  '@automation-platform/diagnostics': path.resolve(__dirname, 'packages/diagnostics/src/index.ts'),
  '@automation-platform/selectors': path.resolve(__dirname, 'packages/selectors/src/index.ts'),
  '@automation-platform/ui-driver': path.resolve(__dirname, 'packages/ui-driver/src/index.ts'),
  '@automation-platform/ui-core': path.resolve(__dirname, 'packages/ui-core/src/index.ts'),
  '@automation-platform/ui-components': path.resolve(__dirname, 'packages/ui-components/src/index.ts'),
  '@automation-platform/ui-flows': path.resolve(__dirname, 'packages/ui-flows/src/index.ts'),
  '@automation-platform/api-core': path.resolve(__dirname, 'packages/api-core/src/index.ts'),
  '@automation-platform/db-core': path.resolve(__dirname, 'packages/db-core/src/index.ts'),
  '@automation-platform/queue-core': path.resolve(__dirname, 'packages/queue-core/src/index.ts'),
  '@automation-platform/data-support': path.resolve(__dirname, 'packages/data-support/src/index.ts'),
  '@automation-platform/repositories': path.resolve(__dirname, 'packages/repositories/src/index.ts'),
  '@automation-platform/gateways': path.resolve(__dirname, 'packages/gateways/src/index.ts'),
  '@automation-platform/plugins': path.resolve(__dirname, 'packages/plugins/src/index.ts'),
  '@automation-platform/governance': path.resolve(__dirname, 'packages/governance/src/index.ts'),
  '@automation-platform/cli': path.resolve(__dirname, 'packages/cli/src/index.ts')
};

export default defineConfig({
  resolve: {
    alias
  },
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'projects/**/tests/**/*.test.ts'],
    passWithNoTests: false,
    reporters: ['default']
  }
});
