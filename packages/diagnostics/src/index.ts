import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DiagnosticArtifact,
  DiagnosticBundle,
  DiagnosticSummary,
  ExecutionContext,
  QueueDiagnosticsEntry
} from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import { DiagnosticsError, nowIso, safeJsonStringify } from '@automation-platform/utils';

export interface UIDiagnosticsProvider {
  screenshot(filePath: string): Promise<void>;
  html(): Promise<string>;
  url(): Promise<string>;
  cookies(): Promise<unknown>;
  localStorage(): Promise<Record<string, string>>;
  sessionStorage(): Promise<Record<string, string>>;
}

export interface DiagnosticsStorageOptions {
  rootDir: string;
  logger: PlatformLogger;
}

export interface ApiTraceRecord {
  request: {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    correlationId?: string;
  };
  responsePreview?: unknown;
  error?: string;
  timestampIso: string;
}

export interface DbTraceRecord {
  operation: string;
  sqlPreview: string;
  durationMs: number;
  success: boolean;
  timestampIso: string;
}

export interface QueueTraceRecord {
  queue: string;
  action: 'publish' | 'poll' | 'ack' | 'wait';
  correlationId?: string;
  success: boolean;
  timestampIso: string;
}

export interface FailureBundleInput {
  context: ExecutionContext;
  stepName?: string;
  error?: unknown;
  uiProvider?: UIDiagnosticsProvider;
  apiTraces?: ApiTraceRecord[];
  dbTraces?: DbTraceRecord[];
  queueTraces?: QueueTraceRecord[];
  selectorDebug?: Record<string, unknown>;
  consoleEntries?: unknown[];
  failedNetworkRequests?: unknown[];
  queueDiagnostics?: QueueDiagnosticsEntry[];
}

export class DiagnosticsCollector {
  private readonly artifacts: DiagnosticArtifact[] = [];

  public constructor(private readonly options: DiagnosticsStorageOptions) {}

  public async init(): Promise<void> {
    await fs.mkdir(this.options.rootDir, { recursive: true });
  }

  public async addJsonArtifact(name: string, payload: unknown, type: DiagnosticArtifact['type']): Promise<string> {
    const filePath = path.join(this.options.rootDir, `${name}.json`);
    await fs.writeFile(filePath, safeJsonStringify(payload), 'utf8');
    this.register(type, name, filePath);
    return filePath;
  }

  public register(type: DiagnosticArtifact['type'], name: string, filePath: string): DiagnosticArtifact {
    const artifact: DiagnosticArtifact = {
      id: `${type}-${this.artifacts.length + 1}`,
      type,
      name,
      path: filePath,
      createdAtIso: nowIso()
    };
    this.artifacts.push(artifact);
    return artifact;
  }

  public createBundle(summary: DiagnosticSummary): DiagnosticBundle {
    return {
      summary,
      artifacts: [...this.artifacts]
    };
  }
}

export const createFailureBundle = async (input: FailureBundleInput): Promise<DiagnosticBundle> => {
  const diagnosticsDir = path.join('artifacts', 'diagnostics', input.context.executionId);
  const collector = new DiagnosticsCollector({
    rootDir: diagnosticsDir,
    logger: input.context.logger
  });

  await collector.init();

  try {
    if (input.uiProvider) {
      const screenshotPath = path.join(diagnosticsDir, 'page.png');
      await input.uiProvider.screenshot(screenshotPath);
      collector.register('screenshot', 'page', screenshotPath);

      await collector.addJsonArtifact('url', { url: await input.uiProvider.url() }, 'json');
      await collector.addJsonArtifact('cookies', await input.uiProvider.cookies(), 'json');
      await collector.addJsonArtifact('localStorage', await input.uiProvider.localStorage(), 'json');
      await collector.addJsonArtifact('sessionStorage', await input.uiProvider.sessionStorage(), 'json');

      const htmlPath = path.join(diagnosticsDir, 'page.html');
      await fs.writeFile(htmlPath, await input.uiProvider.html(), 'utf8');
      collector.register('html', 'page-html', htmlPath);
    }

    if (input.apiTraces && input.apiTraces.length > 0) {
      await collector.addJsonArtifact('api-traces', input.apiTraces, 'json');
    }
    if (input.dbTraces && input.dbTraces.length > 0) {
      await collector.addJsonArtifact('db-traces', input.dbTraces, 'json');
    }
    if (input.queueTraces && input.queueTraces.length > 0) {
      await collector.addJsonArtifact('queue-traces', input.queueTraces, 'json');
    }
    if (input.selectorDebug) {
      await collector.addJsonArtifact('selector-debug', input.selectorDebug, 'json');
    }
    if (input.consoleEntries && input.consoleEntries.length > 0) {
      await collector.addJsonArtifact('console-entries', input.consoleEntries, 'console');
    }
    if (input.failedNetworkRequests && input.failedNetworkRequests.length > 0) {
      await collector.addJsonArtifact('failed-network', input.failedNetworkRequests, 'network');
    }
    if (input.queueDiagnostics && input.queueDiagnostics.length > 0) {
      await collector.addJsonArtifact('queue-diagnostics', input.queueDiagnostics, 'json');
    }

    const finishedAt = new Date();
    const summary: DiagnosticSummary = {
      executionId: input.context.executionId,
      startedAtIso: input.context.startedAt.toISOString(),
      finishedAtIso: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - input.context.startedAt.getTime()
    };

    if (input.context.metadata?.testId) {
      summary.testId = input.context.metadata.testId;
    }

    if (input.stepName) {
      summary.failedStep = input.stepName;
    }

    if (input.error !== undefined) {
      summary.errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
    }

    const bundle = collector.createBundle(summary);
    const manifestPath = path.join(diagnosticsDir, 'manifest.json');
    await fs.writeFile(manifestPath, safeJsonStringify(bundle), 'utf8');
    collector.register('json', 'manifest', manifestPath);

    input.context.logger.error('Failure diagnostics bundle created', {
      executionId: input.context.executionId,
      artifactsCount: bundle.artifacts.length,
      manifestPath
    });

    return collector.createBundle(summary);
  } catch (error) {
    throw new DiagnosticsError('Failed to create diagnostics bundle', {
      cause: error,
      metadata: { executionId: input.context.executionId }
    });
  }
};

