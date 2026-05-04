import pino from 'pino';
import type { LogMeta, LogLevel, PlatformLogger } from '@automation-platform/contracts';
import { maskSensitive } from '@automation-platform/utils';

export interface LoggerFactoryOptions {
  level: LogLevel;
  serviceName: string;
  environment: string;
  humanReadable?: boolean;
  redactPaths?: string[];
}

export interface LoggerContext {
  correlationId?: string;
  executionId?: string;
  testId?: string;
  [key: string]: unknown;
}

class PinoPlatformLogger implements PlatformLogger {
  public constructor(private readonly inner: ReturnType<typeof pino>) {}

  public child(bindings: Record<string, unknown>): PlatformLogger {
    return new PinoPlatformLogger(this.inner.child(bindings));
  }

  public debug(message: string, meta?: LogMeta): void {
    this.inner.debug(sanitizeLogMeta(meta), message);
  }

  public info(message: string, meta?: LogMeta): void {
    this.inner.info(sanitizeLogMeta(meta), message);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.inner.warn(sanitizeLogMeta(meta), message);
  }

  public error(message: string, meta?: LogMeta): void {
    this.inner.error(sanitizeLogMeta(meta), message);
  }

  public fatal(message: string, meta?: LogMeta): void {
    this.inner.fatal(sanitizeLogMeta(meta), message);
  }
}

export const sanitizeLogMeta = (meta?: LogMeta): LogMeta | undefined => {
  if (!meta) {
    return undefined;
  }
  return maskSensitive(meta) as LogMeta;
};

export const createLogger = (options: LoggerFactoryOptions): PlatformLogger => {
  const loggerOptions: Parameters<typeof pino>[0] = {
    level: options.level,
    name: options.serviceName,
    base: {
      service: options.serviceName,
      env: options.environment
    },
    redact: {
      paths: options.redactPaths ?? ['req.headers.authorization', 'password', '*.token'],
      remove: false,
      censor: '***'
    }
  };

  if (options.humanReadable) {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: false,
        singleLine: true,
        translateTime: 'SYS:standard'
      }
    };
  }

  const logger = pino(loggerOptions);
  return new PinoPlatformLogger(logger);
};

export const withLoggerContext = (logger: PlatformLogger, context: LoggerContext): PlatformLogger =>
  logger.child(context);
