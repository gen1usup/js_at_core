import puppeteer, {
  type Browser,
  type ConsoleMessage,
  type Dialog,
  type HTTPRequest,
  type HTTPResponse,
  type Page
} from 'puppeteer';
import type {
  ExecutionContext,
  ResolvedSelector,
  UIActionOptions,
  UIDriver,
  UIWaitOptions
} from '@automation-platform/contracts';
import type { UIDiagnosticsProvider } from '@automation-platform/diagnostics';
import type { PlatformLogger } from '@automation-platform/contracts';
import { toPuppeteerSelector } from '@automation-platform/selectors';
import { retry, TimeoutError, UIActionError } from '@automation-platform/utils';

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

export class PuppeteerUiDriver implements UIDriver, UIDiagnosticsProvider {
  private readonly consoleEntries: Array<{ type: string; text: string }> = [];
  private readonly failedRequests: Array<{ url: string; method: string; errorText?: string | undefined }> = [];
  private readonly responses: Array<{ url: string; status: number; ok: boolean }> = [];
  private lastStep?: string;

  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
    private readonly logger: PlatformLogger,
    private readonly hooks: UiDriverHooks = {}
  ) {
    this.bindListeners();
  }

  public static async launch(
    config: BrowserLaunchConfig,
    logger: PlatformLogger,
    hooks?: UiDriverHooks
  ): Promise<PuppeteerUiDriver> {
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: config.headless,
      slowMo: config.slowMoMs,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    };

    if (config.userDataDir) {
      launchOptions.userDataDir = config.userDataDir;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport(config.viewport);
    page.setDefaultNavigationTimeout(config.defaultNavigationTimeoutMs);

    return new PuppeteerUiDriver(browser, page, logger, hooks);
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

    const gotoOptions: Parameters<Page['goto']>[1] = {
      waitUntil: options?.waitUntil ?? 'domcontentloaded'
    };

    if (options?.timeoutMs !== undefined) {
      gotoOptions.timeout = options.timeoutMs;
    }

    await this.page.goto(url, gotoOptions);
  }

  public async close(): Promise<void> {
    await this.browser.close();
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
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.click();
      },
      options
    );
  }

  public async doubleClick(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'double-click',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.click({ clickCount: 2 });
      },
      options
    );
  }

  public async hover(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'hover',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.hover();
      },
      options
    );
  }

  public async fill(selector: ResolvedSelector, value: string, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'fill',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await handle.type(value);
      },
      options
    );
  }

  public async clear(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'clear',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
      },
      options
    );
  }

  public async type(selector: ResolvedSelector, value: string, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'type',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await handle.type(value);
      },
      options
    );
  }

  public async press(selector: ResolvedSelector, key: string, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'press',
      selector,
      async () => {
        await this.waitForElement(selector, options?.timeoutMs);
        await this.page.keyboard.press(key as never);
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
        const resolved = toPuppeteerSelector(selector);
        if (resolved.kind !== 'css') {
          throw new UIActionError('Select requires css/testId selector strategy', {
            metadata: { selector: selector.key }
          });
        }
        const values = Array.isArray(value) ? value : [value];
        await this.page.select(resolved.value, ...values);
      },
      options
    );
  }

  public async check(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'check',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        const checked = await handle.evaluate((node) => {
          const input = node as unknown as { checked?: boolean };
          return Boolean(input.checked);
        });
        if (!checked) {
          await handle.click();
        }
      },
      options
    );
  }

  public async uncheck(selector: ResolvedSelector, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'uncheck',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        const checked = await handle.evaluate((node) => {
          const input = node as unknown as { checked?: boolean };
          return Boolean(input.checked);
        });
        if (checked) {
          await handle.click();
        }
      },
      options
    );
  }

  public async upload(selector: ResolvedSelector, filePath: string, options?: UIActionOptions): Promise<void> {
    await this.withAction(
      'upload',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        await (handle as unknown as { uploadFile: (...paths: string[]) => Promise<void> }).uploadFile(
          filePath
        );
      },
      options
    );
  }

  public async text(selector: ResolvedSelector, options?: UIActionOptions): Promise<string> {
    return this.withAction(
      'text',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        return handle.evaluate((node) => node.textContent?.trim() ?? '');
      },
      options
    );
  }

  public async value(selector: ResolvedSelector, options?: UIActionOptions): Promise<string> {
    return this.withAction(
      'value',
      selector,
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        return handle.evaluate((node) => {
          const input = node as unknown as { value?: unknown };
          return String(input.value ?? '');
        });
      },
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
      async () => {
        const handle = await this.waitForElement(selector, options?.timeoutMs);
        return handle.evaluate((node, attrName) => node.getAttribute(attrName), attribute);
      },
      options
    );
  }

  public async waitForVisible(selector: ResolvedSelector, options: UIWaitOptions = {}): Promise<void> {
    await this.waitForElement(selector, options.timeoutMs, true);
  }

  public async waitForHidden(selector: ResolvedSelector, options: UIWaitOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 10_000;
    const resolved = toPuppeteerSelector(selector);

    if (resolved.kind === 'css') {
      await this.page.waitForSelector(resolved.value, { hidden: true, timeout: timeoutMs });
      return;
    }

    await this.page.waitForSelector(`::-p-xpath(${resolved.value})`, {
      hidden: true,
      timeout: timeoutMs
    });
  }

  public async waitForExists(selector: ResolvedSelector, options: UIWaitOptions = {}): Promise<void> {
    await this.waitForElement(selector, options.timeoutMs, false);
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
    return this.page.cookies();
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
    const page = await this.browser.newPage();
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
    context: ExecutionContext,
    browser: Browser,
    page: Page,
    hooks?: UiDriverHooks
  ): PuppeteerUiDriver {
    return new PuppeteerUiDriver(browser, page, context.logger, hooks);
  }

  private bindListeners(): void {
    this.page.on('console', (message: ConsoleMessage) => {
      const entry = { type: message.type(), text: message.text() };
      this.consoleEntries.push(entry);
      this.hooks.onConsole?.(entry);
    });

    this.page.on('requestfailed', (request: HTTPRequest) => {
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

    this.page.on('response', (response: HTTPResponse) => {
      const entry = {
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      };
      this.responses.push(entry);
      this.hooks.onResponse?.(entry);
    });
  }

  private async waitForElement(selector: ResolvedSelector, timeoutMs = 10_000, visible = true) {
    const resolved = toPuppeteerSelector(selector);

    if (resolved.kind === 'css') {
      const element = await this.page.waitForSelector(resolved.value, {
        timeout: timeoutMs,
        visible
      });
      if (!element) {
        throw new TimeoutError(`Element not found: ${selector.namespace}.${selector.key}`);
      }
      return element;
    }

    const element = await this.page.waitForSelector(`::-p-xpath(${resolved.value})`, {
      timeout: timeoutMs,
      visible
    });

    if (!element) {
      throw new TimeoutError(`Element not found (xpath): ${selector.namespace}.${selector.key}`);
    }

    return element;
  }

  private async withAction<T>(
    actionName: string,
    selector: ResolvedSelector,
    callback: () => Promise<T>,
    options?: UIActionOptions
  ): Promise<T> {
    const retryPolicy = options?.retryPolicy ?? { maxAttempts: 1, delayMs: 0, backoffFactor: 1 };

    this.lastStep = `${actionName}:${selector.namespace}.${selector.key}`;

    return retry(
      async () => {
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
      },
      retryPolicy
    );
  }
}
