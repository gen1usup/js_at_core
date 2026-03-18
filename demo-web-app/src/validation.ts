export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const assertObject = (value: unknown, message: string): Record<string, unknown> => {
  if (!isObject(value)) {
    throw new ValidationError(message);
  }
  return value;
};

export const readString = (
  source: Record<string, unknown>,
  key: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
  } = {}
): string => {
  const raw = source[key];
  if (typeof raw !== 'string') {
    throw new ValidationError(`Field "${key}" must be a string`);
  }

  const value = raw.trim();

  if (!options.allowEmpty && value.length === 0) {
    throw new ValidationError(`Field "${key}" must not be empty`);
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new ValidationError(`Field "${key}" must contain at least ${options.minLength} characters`);
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new ValidationError(`Field "${key}" must contain no more than ${options.maxLength} characters`);
  }

  return value;
};

export const readNumber = (
  value: string | undefined,
  fallback: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return parsed;
};

export const ensureStringArray = (value: unknown, fieldName: string): string[] => {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Field "${fieldName}" must be an array`);
  }

  const output: string[] = [];
  value.forEach((item) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new ValidationError(`Field "${fieldName}" must contain non-empty strings`);
    }
    output.push(item);
  });

  return output;
};
