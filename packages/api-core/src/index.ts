import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponseHeaders,
  type RawAxiosResponseHeaders
} from 'axios';
import { z, type ZodSchema } from 'zod';
import type { HttpClient, HttpRequest, HttpResponse, PlatformLogger, RetryPolicy } from '@automation-platform/contracts';
import { ApiTransportError, ApiValidationError, maskSensitive, retry, waitFor } from '@automation-platform/utils';

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs: number;
  retry: RetryPolicy;
  defaultHeaders?: Record<string, string>;
  authTokenProvider?: () => Promise<string | undefined>;
  logger: PlatformLogger;
}

export interface ApiRequestOptions<TResponse> {
  request: HttpRequest;
  responseSchema?: ZodSchema<TResponse>;
  retryPolicy?: RetryPolicy;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  nextCursor?: string;
}

const isAxiosError = (value: unknown): value is AxiosError =>
  typeof value === 'object' && value !== null && (value as AxiosError).isAxiosError === true;

const appendQuery = (pathValue: string, query: HttpRequest['query'] | undefined): string => {
  if (!query || Object.keys(query).length === 0) {
    return pathValue;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        search.append(key, String(item));
      });
    } else {
      search.set(key, String(value));
    }
  }

  const serialized = search.toString();
  return serialized.length > 0 ? `${pathValue}?${serialized}` : pathValue;
};

const normalizeHeaders = (
  headers: AxiosResponseHeaders | Partial<RawAxiosResponseHeaders>
): Record<string, string | string[] | undefined> => {
  const normalized: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === null) {
      normalized[key] = undefined;
      continue;
    }
    if (Array.isArray(value)) {
      normalized[key] = value.map(String);
      continue;
    }
    normalized[key] = String(value);
  }
  return normalized;
};

export class AxiosHttpClient implements HttpClient {
  private readonly client: AxiosInstance;

  public constructor(private readonly config: ApiClientConfig) {
    const initConfig: AxiosRequestConfig = {
      baseURL: config.baseUrl,
      timeout: config.timeoutMs
    };

    if (config.defaultHeaders) {
      initConfig.headers = config.defaultHeaders;
    }

    this.client = axios.create(initConfig);

    this.client.interceptors.request.use(async (request) => {
      const token = await this.config.authTokenProvider?.();
      if (token) {
        request.headers = request.headers ?? {};
        request.headers.Authorization = `Bearer ${token}`;
      }
      return request;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.config.logger.error('API response interceptor captured error', {
          status: error.response?.status,
          method: error.config?.method,
          url: error.config?.url,
          data: maskSensitive(error.response?.data)
        });
        return Promise.reject(error);
      }
    );
  }

  public async send<TResponse, TBody = unknown>(
    request: HttpRequest<TBody>
  ): Promise<HttpResponse<TResponse>> {
    const startedAt = Date.now();
    const requestConfig: AxiosRequestConfig = {
      method: request.method,
      url: appendQuery(request.path, request.query),
      timeout: request.timeoutMs ?? this.config.timeoutMs
    };

    if (request.body !== undefined) {
      requestConfig.data = request.body;
    }

    if (request.headers) {
      requestConfig.headers = request.headers;
    }

    try {
      const response = await this.client.request<TResponse>(requestConfig);
      const durationMs = Date.now() - startedAt;

      this.config.logger.info('API request completed', {
        method: request.method,
        path: request.path,
        status: response.status,
        durationMs,
        correlationId: request.correlationId
      });

      return {
        status: response.status,
        headers: normalizeHeaders(response.headers),
        data: response.data,
        durationMs
      };
    } catch (error) {
      throw mapApiError(error, request, startedAt);
    }
  }

  public async request<TResponse>(options: ApiRequestOptions<TResponse>): Promise<TResponse> {
    const policy = options.retryPolicy ?? this.config.retry;

    const response = await retry(
      async () => this.send<TResponse>(options.request),
      policy,
      (error) => {
        if (error instanceof UnifiedApiError) {
          return error.retryable;
        }
        return true;
      }
    );

    if (options.responseSchema) {
      const parsed = options.responseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new ApiValidationError('Response validation failed', {
          metadata: {
            issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          }
        });
      }
      return parsed.data;
    }

    return response.data;
  }

  public async paginate<TItem>(
    requestFactory: (cursor?: string) => HttpRequest,
    options: {
      responseSchema: ZodSchema<PaginatedResponse<TItem>>;
      maxPages?: number;
    }
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const response = await this.request<PaginatedResponse<TItem>>({
        request: requestFactory(cursor),
        responseSchema: options.responseSchema
      });

      items.push(...response.items);
      cursor = response.nextCursor;
      pages += 1;
    } while (cursor && pages < (options.maxPages ?? 50));

    return items;
  }

  public async poll<TResponse>(
    requestFactory: () => HttpRequest,
    matcher: (data: TResponse) => boolean,
    options: {
      timeoutMs: number;
      pollingIntervalMs: number;
      responseSchema?: ZodSchema<TResponse>;
    }
  ): Promise<TResponse> {
    return waitFor(
      async () => {
        const requestOptions: ApiRequestOptions<TResponse> = {
          request: requestFactory()
        };

        if (options.responseSchema) {
          requestOptions.responseSchema = options.responseSchema;
        }

        const data = await this.request<TResponse>(requestOptions);
        return matcher(data) ? data : undefined;
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: 'API poll condition'
      }
    );
  }

  public async waitForEventuallyConsistentState<TResponse>(
    requestFactory: () => HttpRequest,
    predicate: (data: TResponse) => boolean,
    timeoutMs = 15_000
  ): Promise<TResponse> {
    return this.poll<TResponse>(requestFactory, predicate, {
      timeoutMs,
      pollingIntervalMs: 500
    });
  }
}

export interface ApiErrorShape {
  message: string;
  status?: number;
  apiCode?: string;
  retryable: boolean;
  body?: unknown;
}

export class UnifiedApiError extends ApiTransportError {
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly apiCode?: string;
  public readonly body?: unknown;

  public constructor(shape: ApiErrorShape, cause?: unknown) {
    super(shape.message, {
      cause,
      metadata: {
        status: shape.status,
        code: shape.apiCode,
        retryable: shape.retryable,
        body: maskSensitive(shape.body)
      }
    });
    this.retryable = shape.retryable;
    if (shape.status !== undefined) {
      this.status = shape.status;
    }
    if (shape.apiCode !== undefined) {
      this.apiCode = shape.apiCode;
    }
    if (shape.body !== undefined) {
      this.body = shape.body;
    }
  }
}

const mapApiError = (error: unknown, request: HttpRequest, startedAt: number): UnifiedApiError => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const retryable = status === undefined || status >= 500 || status === 429;

    const shape: ApiErrorShape = {
      message: `API request failed: ${request.method} ${request.path}`,
      retryable,
      body: error.response?.data
    };

    if (status !== undefined) {
      shape.status = status;
    }

    if (error.code) {
      shape.apiCode = error.code;
    }

    return new UnifiedApiError(shape, {
      originalMessage: error.message,
      durationMs: Date.now() - startedAt
    });
  }

  return new UnifiedApiError(
    {
      message: `API request failed: ${request.method} ${request.path}`,
      retryable: true
    },
    error
  );
};

export const paginatedResponseSchema = <TItem>(itemSchema: ZodSchema<TItem>) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional()
  });
