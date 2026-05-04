import {
  chromium,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Dialog,
  type Locator,
  type Page,
  type Request,
  type Response
} from 'playwright';
import type {
  ExecutionContext,
  ResolvedSelector,
  UIActionOptions,
  UIDriver,
  UIWaitOptions
} from '@automation-platform/contracts';
import type { UIDiagnosticsProvider } from '@automation-platform/diagnostics';
import type { PlatformLogger } from '@automation-platform/contracts';
import { toPlaywrightSelector } from '@automation-platform/selectors';
import { retry, UIActionError } from '@automation-platform/utils';

export interface BrowserLaunchConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  slowMoMs: number;
  defaultNavigationTimeoutMs: number;
  userDataDir?: string;
}

export interface UiDriverHooks {
  onConsole?(entry: { type: string; text: string }): void;
  onRequestFailed?(entry: { url: string; method: string; errorText?: string | undefined }): void;
  onResponse?(entry: { url: string; status: number; ok: boolean }): void;
}

export interface DriverDiagnosticsSnapshot {
  consoleEntries: Array<{ type: string; text: string }>;
  failedRequests: Array<{ url: string; method: string; errorText?: string | undefined }>;
  responses: Array<{ url: string; status: number; ok: boolean }>;
  lastStep?: string | undefined;
}

export class PlaywrightUiDriver implements UIDriver, UIDiagnosticsProvider {
  private readonly consoleEntries: Array<{ type: string; text: string }> = [];
  private readonly failedRequests: Array<{
    url: string;
    method: string;
    errorText?: string | undefined;
  }> = [];
  private readonly responses: Array<{ url: string; status: number; ok: boolean }> = [];
  private lastStep?: string;

  private constructor(
    private readonly browser: Browser | undefined,
    private readonly browserContext: BrowserContext,
    private readonly page: Page,
    private readonly logger: PlatformLogger,
    private readonly hooks: UiDriverHooks = {}
  ) {
    this.bindListeners(this.page);
  }

  public static async launch(
    config: BrowserLaunchConfig,
    logger: PlatformLogger,
    hooks?: UiDriverHooks
  ): Promise<PlaywrightUiDriver> {
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: config.headless,
      slowMo: config.slowMoMs,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    };

    if (config.userDataDir) {
      const browserContext = await chromium.launchPersistentContext(config.userDataDir, {
        ...launchOptions,
        viewport: config.viewport
      });
      browserContext.setDefaultNavigationTimeout(config.defaultNavigationTimeoutMs);
      browserContext.setDefaultTimeout(config.defaultNavigationTimeoutMs);
      const page = browserContext.pages()[0] ?? (await browserContext.newPage());
      return new PlaywrightUiDriver(undefined, browserContext, page, logger, hooks);
    }

    const browser = await chromium.launch(launchOptions);
    const browserContext = await browser.newContext({ viewport: config.viewport });
    browserContext.setDefaultNavigationTimeout(config.defaultNavigationTimeoutMs);
    browserContext.setDefaultTimeout(config.defaultNavigationTimeoutMs);
    const page = await browserContext.newPage();

    return new PlaywrightUiDriver(browser, browserContext, page, logger, hooks);
  }

  public getRawPage(): Page {
    return this.page;
  }

  public async goto(
    url: string,
    options?: {
      timeoutMs?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    }
  ): Promise<void> {
    this.lastStep = `goto:${url}`;

    await this.page.goto(url, {
      waitUntil: this.mapWaitUntil(options?.waitUntil),
      ...this.withTimeout(options?.timeoutMs)
    });
  }

  public async close(): Promise<void> {
    await this.browserContext.close();
    await this.browser?.close();
  }

  public async currentUrl(): Promise<string> {
    return this.page.url();
  }

  public async screenshot(filePath: string, options?: { fullPage?: boolean }): Promise<void> {
    await this.page.screenshot({
      path: filePath,
      fullPage: options?.fullPage ?? true
    });
  }

  public async click(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'click',
      selector,
      async () => {
        await this.locatorFor(selector).click(this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async doubleClick(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'double-click',
      selector,
      async () => {
        await this.locatorFor(selector).dblclick(this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async hover(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'hover',
      selector,
      async () => {
        await this.locatorFor(selector).hover(this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async fill(
    selector: ResolvedSelector,
    value: string,
    options?: UIActionOptions
  ): Promise<void> {
    await this.withAction(
      'fill',
      selector,
      async () => {
        await this.locatorFor(selector).fill(value, this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async clear(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'clear',
      selector,
      async () => {
        await this.locatorFor(selector).fill('', this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async type(
    selector: ResolvedSelector,
    value: string,
    options?: UIActionOptions
  ): Promise<void> {
    await this.withAction(
      'type',
      selector,
      async () => {
        await this.locatorFor(selector).pressSequentially(
          value,
          this.withTimeout(options?.timeoutMs)
        );
      },
      options
    );
  }

  public async press(
    selector: ResolvedSelector,
    key: string,
    options?: UIActionOptions
  ): Promise<void> {
    await this.withAction(
      'press',
      selector,
      async () => {
        await this.locatorFor(selector).press(key, this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async select(
    selector: ResolvedSelector,
    value: string | string[],
    options?: UIActionOptions
  ): Promise<void> {
    await this.withAction(
      'select',
      selector,
      async () => {
        await this.locatorFor(selector).selectOption(value, this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async check(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'check',
      selector,
      async () => {
        await this.locatorFor(selector).check(this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async uncheck(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'uncheck',
      selector,
      async () => {
        await this.locatorFor(selector).uncheck(this.withTimeout(options?.timeoutMs));
      },
      options
    );
  }

  public async upload(
    selector: ResolvedSelector,
    filePath: string,
    options?: UIActionOptions
  ): Promise<void> {
    await this.withAction(
      'upload',
      selector,
      async () => {
        await this.locatorFor(selector).setInputFiles(
          filePath,
          this.withTimeout(options?.timeoutMs)
        );
      },
      options
    );
  }

  public async text(selector: ResolvedSelector, options?: UIActionOptions): Promise<string> {
    return this.withAction(
      'text',
      selector,
      async () =>
        (
          await this.locatorFor(selector).textContent(this.withTimeout(options?.timeoutMs))
        )?.trim() ?? '',
      options
    );
  }

  public async value(selector: ResolvedSelector, options?: UIActionOptions): Promise<string> {
    return this.withAction(
      'value',
      selector,
      async () => this.locatorFor(selector).inputValue(this.withTimeout(options?.timeoutMs)),
      options
    );
  }

  public async attribute(
    selector: ResolvedSelector,
    attribute: string,
    options?: UIActionOptions
  ): Promise<string | null> {
    return this.withAction(
      'attribute',
      selector,
      async () =>
        this.locatorFor(selector).getAttribute(attribute, this.withTimeout(options?.timeoutMs)),
      options
    );
  }

  public async waitForVisible(
    selector: ResolvedSelector,
    options: UIWaitOptions = {}
  ): Promise<void> {
    await this.locatorFor(selector).waitFor({
      state: 'visible',
      timeout: options.timeoutMs ?? 10_000
    });
  }

  public async waitForHidden(
    selector: ResolvedSelector,
    options: UIWaitOptions = {}
  ): Promise<void> {
    await this.locatorFor(selector).waitFor({
      state: 'hidden',
      timeout: options.timeoutMs ?? 10_000
    });
  }

  public async waitForExists(
    selector: ResolvedSelector,
    options: UIWaitOptions = {}
  ): Promise<void> {
    await this.locatorFor(selector).waitFor({
      state: 'attached',
      timeout: options.timeoutMs ?? 10_000
    });
  }

  public async evaluate<TOutput>(expression: () => TOutput): Promise<TOutput> {
    return this.page.evaluate(expression);
  }

  public async html(): Promise<string> {
    return this.page.content();
  }

  public async url(): Promise<string> {
    return this.currentUrl();
  }

  public async cookies(): Promise<unknown> {
    return this.browserContext.cookies();
  }

  public async localStorage(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const output: Record<string, string> = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) {
          output[key] = localStorage.getItem(key) ?? '';
        }
      }
      return output;
    });
  }

  public async sessionStorage(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const output: Record<string, string> = {};
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key) {
          output[key] = sessionStorage.getItem(key) ?? '';
        }
      }
      return output;
    });
  }

  public async openNewTab(url?: string): Promise<Page> {
    const page = await this.browserContext.newPage();
    this.bindListeners(page);
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    return page;
  }

  public async withDialogHandler(
    handler: (dialog: Dialog) => Promise<void>,
    action: () => Promise<void>
  ): Promise<void> {
    const listener = async (dialog: Dialog): Promise<void> => {
      await handler(dialog);
    };
    this.page.on('dialog', listener);
    try {
      await action();
    } finally {
      this.page.off('dialog', listener);
    }
  }

  public diagnosticsSnapshot(): DriverDiagnosticsSnapshot {
    const snapshot: DriverDiagnosticsSnapshot = {
      consoleEntries: [...this.consoleEntries],
      failedRequests: [...this.failedRequests],
      responses: [...this.responses]
    };

    if (this.lastStep) {
      snapshot.lastStep = this.lastStep;
    }

    return snapshot;
  }

  public static fromExecutionContext(
    executionContext: ExecutionContext,
    browser: Browser | undefined,
    browserContext: BrowserContext,
    page: Page,
    hooks?: UiDriverHooks
  ): PlaywrightUiDriver {
    return new PlaywrightUiDriver(browser, browserContext, page, executionContext.logger, hooks);
  }

  private bindListeners(page: Page): void {
    page.on('console', (message: ConsoleMessage) => {
      const entry = { type: message.type(), text: message.text() };
      this.consoleEntries.push(entry);
      this.hooks.onConsole?.(entry);
    });

    page.on('requestfailed', (request: Request) => {
      const entry: { url: string; method: string; errorText?: string | undefined } = {
        url: request.url(),
        method: request.method()
      };
      const errorText = request.failure()?.errorText;
      if (errorText) {
        entry.errorText = errorText;
      }

      this.failedRequests.push(entry);
      this.hooks.onRequestFailed?.(entry);
    });

    page.on('response', (response: Response) => {
      const entry = {
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      };
      this.responses.push(entry);
      this.hooks.onResponse?.(entry);
    });
  }

  private locatorFor(selector: ResolvedSelector): Locator {
    const resolved = toPlaywrightSelector(selector);

    switch (resolved.kind) {
      case 'css':
        return this.page.locator(resolved.value);
      case 'xpath':
        return this.page.locator(`xpath=${resolved.value}`);
      case 'testId':
        return this.page.getByTestId(resolved.value);
      case 'text':
        return this.page.getByText(resolved.value);
      default:
        throw new UIActionError('Unsupported selector strategy', {
          metadata: { selector: selector.key }
        });
    }
  }

  private mapWaitUntil(
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' | undefined
  ): 'load' | 'domcontentloaded' | 'networkidle' {
    if (waitUntil === 'networkidle0' || waitUntil === 'networkidle2') {
      return 'networkidle';
    }

    return waitUntil ?? 'domcontentloaded';
  }

  private withTimeout(timeoutMs: number | undefined): { timeout?: number } {
    return timeoutMs === undefined ? {} : { timeout: timeoutMs };
  }

  private async withAction<T>(
    actionName: string,
    selector: ResolvedSelector,
    callback: () => Promise<T>,
    options?: UIActionOptions
  ): Promise<T> {
    const retryPolicy = options?.retryPolicy ?? { maxAttempts: 1, delayMs: 0, backoffFactor: 1 };

    this.lastStep = `${actionName}:${selector.namespace}.${selector.key}`;

    return retry(async () => {
      try {
        const startedAt = Date.now();
        const result = await callback();
        this.logger.debug('UI action complete', {
          actionName,
          selector,
          durationMs: Date.now() - startedAt
        });
        return result;
      } catch (error) {
        throw new UIActionError(`UI action failed: ${actionName}`, {
          cause: error,
          metadata: {
            selector,
            actionName
          }
        });
      }
    }, retryPolicy);
  }
}
