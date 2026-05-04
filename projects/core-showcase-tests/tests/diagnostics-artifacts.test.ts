import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFailureBundle } from '@automation-platform/diagnostics';
import { createExecutionContext } from '@automation-platform/execution';
import { defineMetadata } from '@automation-platform/metadata';
import { DiagnosticsReportPlugin, PluginManager } from '@automation-platform/plugins';
import { createShowcaseLogger, uniqueSuffix } from './support/demo-app';

describe('diagnostics artifacts showcase', () => {
  it('creates a failure bundle and lets the diagnostics plugin persist a JSON report', async () => {
    const unique = uniqueSuffix();
    const pluginOutputDir = path.resolve('artifacts', 'plugins', 'diagnostics-showcase', unique);
    const logger = createShowcaseLogger('diagnostics-artifacts-showcase-test');
    const metadata = defineMetadata({
      testId: 'diagnostics-showcase-001',
      title: 'Diagnostics artifact bundle showcase',
      feature: 'diagnostics',
      component: 'failure-bundle',
      severity: 'medium',
      risk: 'moderate',
      businessCriticality: 'p2',
      owner: 'platform-team',
      tags: ['diagnostics', 'artifacts', 'showcase'],
      estimatedDurationMs: 30_000,
      suite: 'smoke',
      capabilityRequirements: ['diagnostics', 'plugins']
    });

    const context = createExecutionContext({
      projectName: 'diagnostics-showcase',
      environment: 'test',
      capabilityMap: {
        diagnostics: true,
        plugins: true
      },
      featureFlags: {},
      logger,
      metadata
    });

    const diagnosticsDir = path.resolve('artifacts', 'diagnostics', context.executionId);

    try {
      const bundle = await createFailureBundle({
        context,
        stepName: 'demo.api.create-task',
        error: new Error('captured for artifact verification'),
        apiTraces: [
          {
            request: {
              method: 'POST',
              url: '/api/tasks',
              status: 202,
              durationMs: 15,
              correlationId: context.correlationId
            },
            timestampIso: new Date().toISOString()
          }
        ],
        queueTraces: [
          {
            queue: 'demo.task.jobs',
            action: 'publish',
            correlationId: context.correlationId,
            success: true,
            timestampIso: new Date().toISOString()
          }
        ]
      });

      expect(bundle.summary.executionId).toBe(context.executionId);
      expect(bundle.summary.failedStep).toBe('demo.api.create-task');
      expect(bundle.artifacts.some((artifact) => artifact.name === 'api-traces')).toBe(true);
      expect(bundle.artifacts.some((artifact) => artifact.name === 'queue-traces')).toBe(true);

      const pluginManager = new PluginManager(context.logger);
      pluginManager.register(
        new DiagnosticsReportPlugin({
          outputDir: pluginOutputDir
        })
      );

      await pluginManager.runHook('onDiagnostics', context, {
        executionId: context.executionId,
        diagnostics: bundle
      });

      const manifestRaw = await fs.readFile(path.resolve(diagnosticsDir, 'manifest.json'), 'utf8');
      const pluginReportRaw = await fs.readFile(
        path.resolve(pluginOutputDir, `diagnostics-${context.executionId}.json`),
        'utf8'
      );

      expect(manifestRaw).toContain(context.executionId);
      expect(pluginReportRaw).toContain('captured for artifact verification');
    } finally {
      await fs.rm(diagnosticsDir, { recursive: true, force: true });
      await fs.rm(pluginOutputDir, { recursive: true, force: true });
    }
  });
});
