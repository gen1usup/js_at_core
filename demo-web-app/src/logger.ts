export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const sensitiveKeyPattern = /password|token|secret|authorization|cookie/i;

const maskSensitive = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(source).forEach(([key, item]) => {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = '***';
        return;
      }
      output[key] = maskSensitive(item);
    });

    return output;
  }

  return value;
};

class ConsoleJsonLogger implements Logger {
  public constructor(
    private readonly minLevel: LogLevel,
    private readonly bindings: Record<string, unknown> = {}
  ) {}

  public child(bindings: Record<string, unknown>): Logger {
    return new ConsoleJsonLogger(this.minLevel, {
      ...this.bindings,
      ...bindings
    });
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (levelOrder[level] < levelOrder[this.minLevel]) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
      ...(meta ? (maskSensitive(meta) as Record<string, unknown>) : {})
    };

    const serialized = JSON.stringify(payload);

    if (level === 'error') {
      console.error(serialized);
      return;
    }

    if (level === 'warn') {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}

export const createLogger = (level: LogLevel = 'info'): Logger => new ConsoleJsonLogger(level);
