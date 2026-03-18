import { randomUUID } from 'node:crypto';
import type { Capability, CapabilityMap, RetryPolicy } from '@automation-platform/contracts';

export interface ErrorDetails {
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export class PlatformError extends Error {
  public readonly code: string;
  public readonly metadata?: Record<string, unknown>;

  public constructor(code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (details?.metadata) {
      this.metadata = details.metadata;
    }
    if (details?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = details.cause;
    }
  }
}
export class ConfigError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('CONFIG_ERROR', message, details);
  }
}

export class SelectorResolutionError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('SELECTOR_RESOLUTION_ERROR', message, details);
  }
}

export class UIActionError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('UI_ACTION_ERROR', message, details);
  }
}

export class ApiTransportError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('API_TRANSPORT_ERROR', message, details);
  }
}

export class ApiValidationError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('API_VALIDATION_ERROR', message, details);
  }
}

export class DbOperationError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('DB_OPERATION_ERROR', message, details);
  }
}

export class QueueOperationError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('QUEUE_OPERATION_ERROR', message, details);
  }
}

export class TimeoutError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('TIMEOUT_ERROR', message, details);
  }
}

export class DiagnosticsError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('DIAGNOSTICS_ERROR', message, details);
  }
}

export class CleanupError extends PlatformError {
  public constructor(message: string, details?: ErrorDetails) {
    super('CLEANUP_ERROR', message, details);
  }
}

export const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export interface WaitForOptions {
  timeoutMs: number;
  pollingIntervalMs?: number;
  description?: string;
}

export const waitFor = async <T>(
  predicate: () => Promise<T | undefined | null | false> | T | undefined | null | false,
  options: WaitForOptions
): Promise<T> => {
  const pollingIntervalMs = options.pollingIntervalMs ?? 200;
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() <= deadline) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(pollingIntervalMs);
  }

  throw new TimeoutError(
    `Timed out after ${options.timeoutMs}ms waiting for ${options.description ?? 'condition'}`
  );
};

export const retry = async <T>(
  callback: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  isRetryable: (error: unknown) => boolean = () => true
): Promise<T> => {
  let attempt = 0;
  let delayMs = policy.delayMs;
  let lastError: unknown;

  while (attempt < policy.maxAttempts) {
    attempt += 1;
    try {
      return await callback(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= policy.maxAttempts || !isRetryable(error)) {
        break;
      }
      await sleep(delayMs);
      delayMs = Math.round(delayMs * (policy.backoffFactor ?? 1));
    }
  }

  throw lastError;
};

const SENSITIVE_KEY_PATTERNS = [/password/i, /token/i, /secret/i, /authorization/i, /cookie/i];

export const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

export const maskString = (value: string): string => {
  if (value.length <= 4) {
    return '***';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};

export const maskSensitive = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitive(item));
  }

  if (input && typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        const masked = typeof value === 'string' ? maskString(value) : '***';
        return [key, masked] as const;
      }
      return [key, maskSensitive(value)] as const;
    });
    return Object.fromEntries(entries);
  }

  return input;
};

export const createExecutionId = (): string => `exec-${randomUUID()}`;
export const createCorrelationId = (): string => `corr-${randomUUID()}`;

export const nowIso = (): string => new Date().toISOString();

export const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === 'string' ? value : safeJsonStringify(value));
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
};

export const assertCapability = (
  capabilityMap: CapabilityMap,
  capability: Capability,
  reason: string
): void => {
  if (!capabilityMap[capability]) {
    throw new PlatformError('CAPABILITY_DISABLED', `Capability "${capability}" is disabled: ${reason}`);
  }
};

export const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};


