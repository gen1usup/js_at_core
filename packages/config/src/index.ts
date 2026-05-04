import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import type { CapabilityMap, FeatureFlagMap, LogLevel } from '@automation-platform/contracts';
import { ConfigError, maskSensitive } from '@automation-platform/utils';

const capabilityKeys = [
  'ui',
  'api',
  'db',
  'queue',
  'screenshots',
  'networkCapture',
  'consoleCapture',
  'fileUpload',
  'downloadHandling',
  'multiTab',
  'authViaApi',
  'authViaUi',
  'diagnostics',
  'cleanup',
  'plugins'
] as const;

const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

const timeoutSchema = z.object({
  uiActionMs: z.number().int().positive(),
  uiWaitMs: z.number().int().positive(),
  apiMs: z.number().int().positive(),
  dbMs: z.number().int().positive(),
  queueMs: z.number().int().positive(),
  stepMs: z.number().int().positive()
});

const retrySchema = z.object({
  maxAttempts: z.number().int().positive(),
  delayMs: z.number().int().nonnegative(),
  backoffFactor: z.number().positive()
});

const browserSchema = z.object({
  enabled: z.boolean(),
  headless: z.boolean(),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  slowMoMs: z.number().int().nonnegative(),
  defaultNavigationTimeoutMs: z.number().int().positive(),
  downloadsDir: z.string().min(1)
});

const apiSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url(),
  timeoutMs: z.number().int().positive(),
  retry: retrySchema,
  defaultHeaders: z.record(z.string())
});

const dbSchema = z.object({
  enabled: z.boolean(),
  connectionString: z.string().min(1),
  readOnly: z.boolean(),
  maxConnections: z.number().int().positive(),
  statementTimeoutMs: z.number().int().positive(),
  writeAllowedEnvironments: z.array(z.string().min(1))
});

const queueSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['memory', 'custom']),
  endpoint: z.string().optional(),
  timeoutMs: z.number().int().positive(),
  defaultQueueName: z.string().min(1)
});

const loggingSchema = z.object({
  level: logLevelSchema,
  humanReadable: z.boolean(),
  redactKeys: z.array(z.string().min(1)),
  attachSource: z.boolean()
});

const diagnosticsSchema = z.object({
  enabled: z.boolean(),
  artifactDir: z.string().min(1),
  saveScreenshots: z.boolean(),
  saveHtmlSnapshots: z.boolean(),
  saveStorageSnapshots: z.boolean(),
  saveNetworkLogs: z.boolean(),
  saveConsoleLogs: z.boolean()
});

const capabilitiesSchema = z.object(
  Object.fromEntries(capabilityKeys.map((capability) => [capability, z.boolean()])) as Record<
    (typeof capabilityKeys)[number],
    z.ZodBoolean
  >
);

const platformConfigSchema = z.object({
  projectName: z.string().min(1),
  environment: z.string().min(1),
  baseUrl: z.string().url(),
  timeouts: timeoutSchema,
  retry: retrySchema,
  browser: browserSchema,
  api: apiSchema,
  db: dbSchema,
  queue: queueSchema,
  logging: loggingSchema,
  diagnostics: diagnosticsSchema,
  capabilities: capabilitiesSchema,
  featureFlags: z.record(z.boolean()),
  secretsMask: z.array(z.string().min(1)),
  artifactPaths: z.object({
    root: z.string().min(1),
    logs: z.string().min(1),
    diagnostics: z.string().min(1),
    screenshots: z.string().min(1),
    html: z.string().min(1),
    reports: z.string().min(1)
  })
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer TArrayItem>
    ? Array<TArrayItem>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type PlatformConfigInput = DeepPartial<PlatformConfig>;

export interface ConfigLoaderOptions {
  envFilePath?: string;
  base?: PlatformConfigInput;
  environment?: PlatformConfigInput;
  project?: PlatformConfigInput;
  env?: Record<string, string | undefined>;
}

const DEFAULT_CONFIG: PlatformConfig = {
  projectName: 'template-webapp',
  environment: 'local',
  baseUrl: 'https://example.org',
  timeouts: {
    uiActionMs: 10_000,
    uiWaitMs: 10_000,
    apiMs: 8_000,
    dbMs: 8_000,
    queueMs: 12_000,
    stepMs: 20_000
  },
  retry: {
    maxAttempts: 3,
    delayMs: 250,
    backoffFactor: 1.5
  },
  browser: {
    enabled: true,
    headless: true,
    viewport: { width: 1440, height: 900 },
    slowMoMs: 0,
    defaultNavigationTimeoutMs: 30_000,
    downloadsDir: './artifacts/downloads'
  },
  api: {
    enabled: true,
    baseUrl: 'https://example.org',
    timeoutMs: 8_000,
    retry: {
      maxAttempts: 3,
      delayMs: 250,
      backoffFactor: 1.5
    },
    defaultHeaders: {}
  },
  db: {
    enabled: false,
    connectionString: 'postgres://user:pass@localhost:5432/platform',
    readOnly: true,
    maxConnections: 5,
    statementTimeoutMs: 8_000,
    writeAllowedEnvironments: ['dev', 'staging']
  },
  queue: {
    enabled: false,
    provider: 'memory',
    timeoutMs: 10_000,
    defaultQueueName: 'default'
  },
  logging: {
    level: 'info',
    humanReadable: false,
    redactKeys: ['password', 'token', 'secret', 'authorization', 'cookie'],
    attachSource: true
  },
  diagnostics: {
    enabled: true,
    artifactDir: './artifacts',
    saveScreenshots: true,
    saveHtmlSnapshots: true,
    saveStorageSnapshots: true,
    saveNetworkLogs: true,
    saveConsoleLogs: true
  },
  capabilities: {
    ui: true,
    api: true,
    db: false,
    queue: false,
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
  featureFlags: {},
  secretsMask: ['password', 'token', 'secret', 'authorization', 'cookie'],
  artifactPaths: {
    root: './artifacts',
    logs: './artifacts/logs',
    diagnostics: './artifacts/diagnostics',
    screenshots: './artifacts/screenshots',
    html: './artifacts/html',
    reports: './artifacts/reports'
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = <T extends Record<string, unknown>>(target: T, source: DeepPartial<T>): T => {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value as DeepPartial<typeof current>);
      continue;
    }

    result[key] = value;
  }

  return result as T;
};

const envBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return value === '1' || value.toLowerCase() === 'true';
};

const envNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFeatureFlags = (value: string | undefined): Record<string, boolean> => {
  if (!value) {
    return {};
  }

  const entries = value
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const [flag, flagValue] = pair.split(':');
      return [flag?.trim() ?? '', flagValue?.trim() === 'true'] as const;
    })
    .filter(([flag]) => flag.length > 0);

  return Object.fromEntries(entries);
};

const fromEnv = (env: Record<string, string | undefined>): PlatformConfig => {
  const queueConfig: PlatformConfig['queue'] = {
    enabled: envBoolean(env.AP_QUEUE_ENABLED, DEFAULT_CONFIG.queue.enabled),
    provider: env.AP_QUEUE_PROVIDER === 'custom' ? 'custom' : 'memory',
    timeoutMs: envNumber(env.AP_QUEUE_TIMEOUT_MS, DEFAULT_CONFIG.queue.timeoutMs),
    defaultQueueName: env.AP_QUEUE_NAME ?? DEFAULT_CONFIG.queue.defaultQueueName
  };

  const endpoint = env.AP_QUEUE_ENDPOINT;
  if (endpoint) {
    queueConfig.endpoint = endpoint;
  }

  return {
    ...DEFAULT_CONFIG,
    projectName: env.AP_PROJECT_NAME ?? DEFAULT_CONFIG.projectName,
    environment: env.AP_ENV ?? DEFAULT_CONFIG.environment,
    baseUrl: env.AP_BASE_URL ?? DEFAULT_CONFIG.baseUrl,
    browser: {
      enabled: envBoolean(env.AP_UI_ENABLED, DEFAULT_CONFIG.browser.enabled),
      headless: envBoolean(env.AP_BROWSER_HEADLESS, DEFAULT_CONFIG.browser.headless),
      viewport: {
        width: envNumber(env.AP_BROWSER_WIDTH, DEFAULT_CONFIG.browser.viewport.width),
        height: envNumber(env.AP_BROWSER_HEIGHT, DEFAULT_CONFIG.browser.viewport.height)
      },
      slowMoMs: envNumber(env.AP_BROWSER_SLOWMO_MS, DEFAULT_CONFIG.browser.slowMoMs),
      defaultNavigationTimeoutMs: envNumber(
        env.AP_BROWSER_NAV_TIMEOUT_MS,
        DEFAULT_CONFIG.browser.defaultNavigationTimeoutMs
      ),
      downloadsDir: env.AP_DOWNLOADS_DIR ?? DEFAULT_CONFIG.browser.downloadsDir
    },
    api: {
      enabled: envBoolean(env.AP_API_ENABLED, DEFAULT_CONFIG.api.enabled),
      baseUrl: env.AP_BASE_URL ?? DEFAULT_CONFIG.api.baseUrl,
      timeoutMs: envNumber(env.AP_API_TIMEOUT_MS, DEFAULT_CONFIG.api.timeoutMs),
      retry: {
        maxAttempts: envNumber(env.AP_API_RETRY_MAX, DEFAULT_CONFIG.api.retry.maxAttempts),
        delayMs: envNumber(env.AP_API_RETRY_DELAY_MS, DEFAULT_CONFIG.api.retry.delayMs),
        backoffFactor: envNumber(env.AP_API_RETRY_BACKOFF, DEFAULT_CONFIG.api.retry.backoffFactor)
      },
      defaultHeaders: DEFAULT_CONFIG.api.defaultHeaders
    },
    db: {
      enabled: envBoolean(env.AP_DB_ENABLED, DEFAULT_CONFIG.db.enabled),
      connectionString: env.AP_DB_URL ?? DEFAULT_CONFIG.db.connectionString,
      readOnly: envBoolean(env.AP_DB_READ_ONLY, DEFAULT_CONFIG.db.readOnly),
      maxConnections: envNumber(env.AP_DB_MAX_CONNECTIONS, DEFAULT_CONFIG.db.maxConnections),
      statementTimeoutMs: envNumber(env.AP_DB_TIMEOUT_MS, DEFAULT_CONFIG.db.statementTimeoutMs),
      writeAllowedEnvironments:
        env.AP_DB_WRITE_ENVS?.split(',').map((item) => item.trim()) ??
        DEFAULT_CONFIG.db.writeAllowedEnvironments
    },
    queue: queueConfig,
    logging: {
      level: (env.AP_LOG_LEVEL as LogLevel | undefined) ?? DEFAULT_CONFIG.logging.level,
      humanReadable: envBoolean(env.AP_LOG_HUMAN, DEFAULT_CONFIG.logging.humanReadable),
      redactKeys:
        env.AP_LOG_REDACT_KEYS?.split(',').map((item) => item.trim()) ??
        DEFAULT_CONFIG.logging.redactKeys,
      attachSource: envBoolean(env.AP_LOG_ATTACH_SOURCE, DEFAULT_CONFIG.logging.attachSource)
    },
    diagnostics: {
      enabled: envBoolean(env.AP_DIAGNOSTICS_ENABLED, DEFAULT_CONFIG.diagnostics.enabled),
      artifactDir: env.AP_ARTIFACTS_DIR ?? DEFAULT_CONFIG.diagnostics.artifactDir,
      saveScreenshots: envBoolean(
        env.AP_DIAG_SCREENSHOTS,
        DEFAULT_CONFIG.diagnostics.saveScreenshots
      ),
      saveHtmlSnapshots: envBoolean(env.AP_DIAG_HTML, DEFAULT_CONFIG.diagnostics.saveHtmlSnapshots),
      saveStorageSnapshots: envBoolean(
        env.AP_DIAG_STORAGE,
        DEFAULT_CONFIG.diagnostics.saveStorageSnapshots
      ),
      saveNetworkLogs: envBoolean(env.AP_DIAG_NETWORK, DEFAULT_CONFIG.diagnostics.saveNetworkLogs),
      saveConsoleLogs: envBoolean(env.AP_DIAG_CONSOLE, DEFAULT_CONFIG.diagnostics.saveConsoleLogs)
    },
    capabilities: {
      ...DEFAULT_CONFIG.capabilities,
      ui: envBoolean(env.AP_UI_ENABLED, DEFAULT_CONFIG.capabilities.ui),
      api: envBoolean(env.AP_API_ENABLED, DEFAULT_CONFIG.capabilities.api),
      db: envBoolean(env.AP_DB_ENABLED, DEFAULT_CONFIG.capabilities.db),
      queue: envBoolean(env.AP_QUEUE_ENABLED, DEFAULT_CONFIG.capabilities.queue)
    },
    featureFlags: {
      ...DEFAULT_CONFIG.featureFlags,
      ...parseFeatureFlags(env.AP_FEATURE_FLAGS)
    }
  };
};

const normalizePaths = (config: PlatformConfig): PlatformConfig => {
  const root = path.resolve(config.artifactPaths.root);
  const normalize = (segment: string): string =>
    path.isAbsolute(segment)
      ? segment
      : path.resolve(root, segment.replace(/^\.\/?artifacts\/?/, ''));

  return {
    ...config,
    diagnostics: {
      ...config.diagnostics,
      artifactDir: root
    },
    browser: {
      ...config.browser,
      downloadsDir: path.isAbsolute(config.browser.downloadsDir)
        ? config.browser.downloadsDir
        : path.resolve(root, 'downloads')
    },
    artifactPaths: {
      root,
      logs: normalize(config.artifactPaths.logs),
      diagnostics: normalize(config.artifactPaths.diagnostics),
      screenshots: normalize(config.artifactPaths.screenshots),
      html: normalize(config.artifactPaths.html),
      reports: normalize(config.artifactPaths.reports)
    }
  };
};

export const validateConfig = (input: unknown): PlatformConfig => {
  const parsed = platformConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigError('Invalid platform config', {
      metadata: {
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      }
    });
  }
  return parsed.data;
};

export const loadPlatformConfig = (options: ConfigLoaderOptions = {}): PlatformConfig => {
  dotenv.config(options.envFilePath ? { path: options.envFilePath } : undefined);

  const envInput = options.env ?? process.env;
  const withEnv = fromEnv(envInput);
  const withBase = options.base
    ? deepMerge(
        withEnv as Record<string, unknown>,
        options.base as DeepPartial<Record<string, unknown>>
      )
    : (withEnv as Record<string, unknown>);
  const withEnvironment = options.environment
    ? deepMerge(
        withBase as Record<string, unknown>,
        options.environment as DeepPartial<Record<string, unknown>>
      )
    : withBase;
  const withProject = options.project
    ? deepMerge(
        withEnvironment as Record<string, unknown>,
        options.project as DeepPartial<Record<string, unknown>>
      )
    : withEnvironment;

  return normalizePaths(validateConfig(withProject));
};

export const getCapabilityMap = (config: PlatformConfig): CapabilityMap => config.capabilities;

export const getFeatureFlags = (config: PlatformConfig): FeatureFlagMap => config.featureFlags;

export const maskConfig = (config: PlatformConfig): PlatformConfig =>
  maskSensitive(config) as PlatformConfig;

export const defaultConfig = (): PlatformConfig => DEFAULT_CONFIG;
