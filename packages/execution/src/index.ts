import type {
  CleanupRegistry,
  CleanupResult,
  CleanupTask,
  ExecutionContext,
  PlatformLogger,
  RegisteredResource,
  ResourceRegistry,
  RetryPolicy,
  StepResult,
  TestMetadata
} from '@automation-platform/contracts';
import {
  CleanupError,
  createCorrelationId,
  createExecutionId,
  retry,
  TimeoutError
} from '@automation-platform/utils';

export interface CreateExecutionContextInput {
  projectName: string;
  environment: string;
  capabilityMap: ExecutionContext['capabilityMap'];
  featureFlags: ExecutionContext['featureFlags'];
  logger: PlatformLogger;
  metadata?: TestMetadata;
  executionId?: string;
  correlationId?: string;
}

export class InMemoryResourceRegistry implements ResourceRegistry {
  private readonly resources = new Map<string, RegisteredResource>();

  public register(resource: RegisteredResource): void {
    this.resources.set(resource.id, resource);
  }

  public get(resourceId: string): RegisteredResource | undefined {
    return this.resources.get(resourceId);
  }

  public list(type?: string): readonly RegisteredResource[] {
    const values = [...this.resources.values()];
    if (!type) {
      return values;
    }
    return values.filter((resource) => resource.type === type);
  }

  public remove(resourceId: string): void {
    this.resources.delete(resourceId);
  }

  public clear(): void {
    this.resources.clear();
  }
}

export class OrderedCleanupRegistry implements CleanupRegistry {
  private readonly tasks: CleanupTask[] = [];

  public add(task: CleanupTask): void {
    this.tasks.push(task);
  }

  public async runAll(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    for (const task of [...this.tasks].reverse()) {
      try {
        await task.run();
        results.push({
          id: task.id,
          description: task.description,
          success: true
        });
      } catch (error) {
        results.push({
          id: task.id,
          description: task.description,
          success: false,
          error
        });
        if (task.critical) {
          throw new CleanupError(`Critical cleanup task failed: ${task.id}`, {
            cause: error,
            metadata: { taskId: task.id }
          });
        }
      }
    }

    this.tasks.length = 0;
    return results;
  }
}

export interface StepHooks {
  beforeStep?(context: ExecutionContext, stepName: string): Promise<void> | void;
  afterStep?(context: ExecutionContext, stepName: string, durationMs: number): Promise<void> | void;
  onStepError?(
    context: ExecutionContext,
    stepName: string,
    error: unknown,
    attempt: number
  ): Promise<void> | void;
}

export interface StepRunOptions {
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
}

export class StepRunner {
  public constructor(
    private readonly context: ExecutionContext,
    private readonly hooks: StepHooks = {}
  ) {}

  public async run<T>(
    stepName: string,
    handler: () => Promise<T>,
    options: StepRunOptions = {}
  ): Promise<StepResult<T>> {
    await this.hooks.beforeStep?.(this.context, stepName);
    const startedAt = Date.now();
    const retryPolicy = options.retryPolicy ?? { maxAttempts: 1, delayMs: 0, backoffFactor: 1 };

    const data = await retry(async (attempt) => {
      try {
        return await withTimeout(handler(), options.timeoutMs, stepName);
      } catch (error) {
        await this.hooks.onStepError?.(this.context, stepName, error, attempt);
        throw error;
      }
    }, retryPolicy);

    const durationMs = Date.now() - startedAt;
    await this.hooks.afterStep?.(this.context, stepName, durationMs);

    this.context.logger.info(`Step completed: ${stepName}`, {
      stepName,
      durationMs,
      executionId: this.context.executionId
    });

    return {
      stepName,
      attempt: retryPolicy.maxAttempts,
      durationMs,
      data
    };
  }
}

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  operationName: string
): Promise<T> => {
  if (!timeoutMs) {
    return promise;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      // governance-allow hard-sleep: operation timeout primitive
      () => reject(new TimeoutError(`Operation timed out: ${operationName} (${timeoutMs}ms)`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeoutPromise]);
};

export const createExecutionContext = (input: CreateExecutionContextInput): ExecutionContext => {
  const resources = new InMemoryResourceRegistry();
  const cleanup = new OrderedCleanupRegistry();
  const executionId = input.executionId ?? createExecutionId();
  const correlationId = input.correlationId ?? createCorrelationId();

  const context: ExecutionContext = {
    executionId,
    projectName: input.projectName,
    environment: input.environment,
    startedAt: new Date(),
    correlationId,
    capabilityMap: input.capabilityMap,
    featureFlags: input.featureFlags,
    logger: input.logger.child({ executionId, correlationId, projectName: input.projectName }),
    resources,
    cleanup
  };

  if (input.metadata) {
    context.metadata = input.metadata;
  }

  return context;
};

export const runWithCleanup = async <T>(
  context: ExecutionContext,
  callback: (context: ExecutionContext) => Promise<T>
): Promise<T> => {
  try {
    return await callback(context);
  } finally {
    const cleanupResults = await context.cleanup.runAll();
    context.logger.info('Cleanup completed', {
      results: cleanupResults.map((result) => ({
        id: result.id,
        success: result.success
      }))
    });
  }
};
