import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ExecutionContext,
  PlatformPlugin,
  PluginHookName,
  PluginHookPayload
} from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import type { DiagnosticBundle } from '@automation-platform/contracts';

export class PluginManager {
  private readonly plugins: PlatformPlugin[] = [];

  public constructor(private readonly logger: PlatformLogger) {}

  public register(plugin: PlatformPlugin): void {
    this.plugins.push(plugin);
    this.logger.info('Plugin registered', {
      pluginName: plugin.name,
      pluginVersion: plugin.version
    });
  }

  public list(): PlatformPlugin[] {
    return [...this.plugins];
  }

  public async runHook(
    hook: PluginHookName,
    context: ExecutionContext,
    payload: PluginHookPayload
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.enabled === false) {
        continue;
      }

      const handler = plugin.hooks?.[hook];
      if (!handler) {
        continue;
      }

      await handler(context, payload);
    }
  }
}

export interface DiagnosticsReportPluginOptions {
  outputDir: string;
}

export class DiagnosticsReportPlugin implements PlatformPlugin {
  public readonly name = 'diagnostics-report-plugin';
  public readonly version = '1.0.0';

  public readonly hooks: PlatformPlugin['hooks'];

  public constructor(private readonly options: DiagnosticsReportPluginOptions) {
    this.hooks = {
      onDiagnostics: async (_context, payload) => {
        if (!payload.diagnostics) {
          return;
        }
        await this.persistBundle(payload.executionId, payload.diagnostics);
      }
    };
  }

  private async persistBundle(executionId: string, bundle: DiagnosticBundle): Promise<void> {
    await fs.mkdir(this.options.outputDir, { recursive: true });
    const filePath = path.join(this.options.outputDir, `diagnostics-${executionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(bundle, null, 2), 'utf8');
  }
}

export interface AccessibilityPluginContract extends PlatformPlugin {
  runAccessibilityAudit?(context: ExecutionContext): Promise<{ violations: number; reportPath?: string }>;
}

export interface VisualRegressionPluginContract extends PlatformPlugin {
  compareScreenshots?(context: ExecutionContext): Promise<{ mismatches: number; reportPath?: string }>;
}

export interface AIPluginContract extends PlatformPlugin {
  analyzeFailure?(payload: PluginHookPayload): Promise<{ summary: string; recommendations: string[] }>;
}

export const createCustomProjectPlugin = (plugin: PlatformPlugin): PlatformPlugin => plugin;

