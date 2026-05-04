import type {
  ExecutionContext,
  ResolvedSelector,
  RetryPolicy,
  SelectorRegistry,
  UIActionOptions,
  UIWaitOptions,
  UIDriver
} from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import { resolveBestCandidate } from '@automation-platform/selectors';
import { retry, TimeoutError, waitFor } from '@automation-platform/utils';

export interface UICoreOptions {
  driver: UIDriver;
  selectors: SelectorRegistry;
  logger: PlatformLogger;
  defaultTimeoutMs?: number;
  defaultRetryPolicy?: RetryPolicy;
}

export class UICore {
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetryPolicy: RetryPolicy;

  public constructor(private readonly options: UICoreOptions) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
    this.defaultRetryPolicy = options.defaultRetryPolicy ?? {
      maxAttempts: 2,
      delayMs: 150,
      backoffFactor: 1.2
    };
  }

  public resolveSelector(key: string, namespace = 'common'): ResolvedSelector {
    const definition = this.options.selectors.resolve(key, namespace);
    if (!definition) {
      throw new Error(`Selector not found: ${namespace}.${key}`);
    }

    const candidate = resolveBestCandidate(definition);
    if (!candidate) {
      throw new Error(`Selector has no candidates: ${namespace}.${key}`);
    }

    return {
      namespace,
      key,
      candidate
    };
  }

  public async click(key: string, namespace = 'common', options?: UIActionOptions): Promise<void> {
    await this.options.driver.click(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async doubleClick(
    key: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.doubleClick(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async hover(key: string, namespace = 'common', options?: UIActionOptions): Promise<void> {
    await this.options.driver.hover(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async fill(
    key: string,
    value: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.fill(
      this.resolveSelector(key, namespace),
      value,
      this.withDefaults(options)
    );
  }

  public async clear(key: string, namespace = 'common', options?: UIActionOptions): Promise<void> {
    await this.options.driver.clear(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async type(
    key: string,
    value: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.type(
      this.resolveSelector(key, namespace),
      value,
      this.withDefaults(options)
    );
  }

  public async press(
    key: string,
    keyToPress: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.press(
      this.resolveSelector(key, namespace),
      keyToPress,
      this.withDefaults(options)
    );
  }

  public async select(
    key: string,
    value: string | string[],
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.select(
      this.resolveSelector(key, namespace),
      value,
      this.withDefaults(options)
    );
  }

  public async check(key: string, namespace = 'common', options?: UIActionOptions): Promise<void> {
    await this.options.driver.check(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async uncheck(
    key: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.uncheck(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async upload(
    key: string,
    filePath: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<void> {
    await this.options.driver.upload(
      this.resolveSelector(key, namespace),
      filePath,
      this.withDefaults(options)
    );
  }

  public async text(key: string, namespace = 'common', options?: UIActionOptions): Promise<string> {
    return this.options.driver.text(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async value(
    key: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<string> {
    return this.options.driver.value(
      this.resolveSelector(key, namespace),
      this.withDefaults(options)
    );
  }

  public async attribute(
    key: string,
    attribute: string,
    namespace = 'common',
    options?: UIActionOptions
  ): Promise<string | null> {
    return this.options.driver.attribute(
      this.resolveSelector(key, namespace),
      attribute,
      this.withDefaults(options)
    );
  }

  public async waitVisible(
    key: string,
    namespace = 'common',
    options?: UIWaitOptions
  ): Promise<void> {
    await this.options.driver.waitForVisible(
      this.resolveSelector(key, namespace),
      this.withWaitDefaults(options)
    );
  }

  public async waitHidden(
    key: string,
    namespace = 'common',
    options?: UIWaitOptions
  ): Promise<void> {
    await this.options.driver.waitForHidden(
      this.resolveSelector(key, namespace),
      this.withWaitDefaults(options)
    );
  }

  public async waitExists(
    key: string,
    namespace = 'common',
    options?: UIWaitOptions
  ): Promise<void> {
    await this.options.driver.waitForExists(
      this.resolveSelector(key, namespace),
      this.withWaitDefaults(options)
    );
  }

  public async waitText(
    key: string,
    expected: string,
    namespace = 'common',
    options: UIWaitOptions = {}
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    await waitFor(
      async () => {
        const current = await this.text(key, namespace);
        return current.includes(expected) ? current : undefined;
      },
      {
        timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs ?? 200,
        description: `text "${expected}" for ${namespace}.${key}`
      }
    );
  }

  public async waitValue(
    key: string,
    expected: string,
    namespace = 'common',
    options: UIWaitOptions = {}
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    await waitFor(
      async () => {
        const current = await this.value(key, namespace);
        return current === expected ? current : undefined;
      },
      {
        timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs ?? 200,
        description: `value "${expected}" for ${namespace}.${key}`
      }
    );
  }

  public async assertUrl(expected: RegExp | string): Promise<void> {
    const current = await this.options.driver.currentUrl();
    const passed = typeof expected === 'string' ? current === expected : expected.test(current);
    if (!passed) {
      throw new TimeoutError(
        `URL assertion failed. current="${current}" expected="${String(expected)}"`
      );
    }
  }

  public async assertTitle(expected: RegExp | string): Promise<void> {
    const title = await this.options.driver.evaluate(() => document.title);
    const passed = typeof expected === 'string' ? title === expected : expected.test(title);
    if (!passed) {
      throw new TimeoutError(
        `Title assertion failed. current="${title}" expected="${String(expected)}"`
      );
    }
  }

  public static fromExecutionContext(
    context: ExecutionContext,
    driver: UIDriver,
    selectors: SelectorRegistry
  ): UICore {
    return new UICore({
      driver,
      selectors,
      logger: context.logger
    });
  }

  public withRetryableAction<T>(
    actionName: string,
    action: () => Promise<T>,
    retryPolicy: RetryPolicy = this.defaultRetryPolicy
  ): Promise<T> {
    return retry(async (attempt) => {
      this.options.logger.debug('Executing UI retryable action', {
        actionName,
        attempt,
        retryPolicy
      });
      return action();
    }, retryPolicy);
  }

  private withDefaults(options?: UIActionOptions): UIActionOptions {
    const normalized: UIActionOptions = {
      timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs,
      diagnosticsOnFailure: options?.diagnosticsOnFailure ?? true,
      retryPolicy: options?.retryPolicy ?? this.defaultRetryPolicy
    };

    if (options?.stepName) {
      normalized.stepName = options.stepName;
    }

    return normalized;
  }

  private withWaitDefaults(options?: UIWaitOptions): UIWaitOptions {
    return {
      timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs,
      pollingIntervalMs: options?.pollingIntervalMs ?? 200
    };
  }
}
