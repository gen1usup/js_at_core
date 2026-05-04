import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { z } from 'zod';
import type {
  DatabaseClient,
  DbQueryOptions,
  PlatformLogger,
  RetryPolicy
} from '@automation-platform/contracts';
import { DbOperationError, maskSensitive, retry, waitFor } from '@automation-platform/utils';

export const dbConfigSchema = z.object({
  connectionString: z.string().min(1),
  maxConnections: z.number().int().positive(),
  statementTimeoutMs: z.number().int().positive(),
  readOnly: z.boolean(),
  environment: z.string().min(1),
  writeAllowedEnvironments: z.array(z.string().min(1))
});

export type DbConfig = z.infer<typeof dbConfigSchema>;

const WRITE_QUERY_REGEX = /^\s*(insert|update|delete|create|alter|drop|truncate|grant|revoke)/i;

export class PostgresDatabaseClient implements DatabaseClient {
  private readonly pool: Pool;

  public constructor(
    private readonly config: DbConfig,
    private readonly logger: PlatformLogger
  ) {
    const parsed = dbConfigSchema.parse(config);
    this.pool = new Pool({
      connectionString: parsed.connectionString,
      max: parsed.maxConnections,
      statement_timeout: parsed.statementTimeoutMs
    });
  }

  public async queryOne<T>(
    sql: string,
    params: readonly unknown[],
    mapper?: (row: unknown) => T,
    options?: DbQueryOptions
  ): Promise<T | null> {
    const rows = await this.queryMany(sql, params, mapper, options);
    return rows[0] ?? null;
  }

  public async queryMany<T>(
    sql: string,
    params: readonly unknown[],
    mapper?: (row: unknown) => T,
    options?: DbQueryOptions
  ): Promise<T[]> {
    this.ensureAllowed(sql);
    const startedAt = Date.now();

    try {
      const result = await this.pool.query(sql, params as unknown[]);
      const mapped = mapper
        ? result.rows.map((row) => mapper(row))
        : (result.rows as unknown as T[]);

      this.logSuccess(sql, params, Date.now() - startedAt, result.rowCount ?? 0, options);
      return mapped;
    } catch (error) {
      throw this.mapError(error, sql, params, options);
    }
  }

  public async scalar<T>(
    sql: string,
    params: readonly unknown[],
    options?: DbQueryOptions
  ): Promise<T | null> {
    const row = await this.queryOne<Record<string, unknown>>(sql, params, undefined, options);
    if (!row) {
      return null;
    }
    const firstKey = Object.keys(row)[0];
    return (firstKey ? (row[firstKey] as T | undefined) : undefined) ?? null;
  }

  public async exists(
    sql: string,
    params: readonly unknown[],
    options?: DbQueryOptions
  ): Promise<boolean> {
    const value = await this.scalar<unknown>(sql, params, options);
    return Boolean(value);
  }

  public async execute(
    sql: string,
    params: readonly unknown[],
    options?: DbQueryOptions
  ): Promise<number> {
    this.ensureAllowed(sql);
    const startedAt = Date.now();

    try {
      const result = await this.pool.query(sql, params as unknown[]);
      this.logSuccess(sql, params, Date.now() - startedAt, result.rowCount ?? 0, options);
      return result.rowCount ?? 0;
    } catch (error) {
      throw this.mapError(error, sql, params, options);
    }
  }

  public async transaction<T>(action: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.connect();

    try {
      await connection.query('BEGIN');
      const transactionClient = new TransactionDatabaseClient(
        connection,
        this.config,
        this.logger.child({ transaction: true })
      );
      const result = await action(transactionClient);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw this.mapError(error, 'TRANSACTION', [], undefined);
    } finally {
      connection.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async waitForExists(
    sql: string,
    params: readonly unknown[],
    options: {
      timeoutMs: number;
      pollingIntervalMs: number;
    }
  ): Promise<void> {
    await waitFor(
      async () => {
        const exists = await this.exists(sql, params);
        return exists ? true : undefined;
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: 'db condition'
      }
    );
  }

  public withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
    return retry(async () => operation(), policy);
  }

  private ensureAllowed(sql: string): void {
    if (!WRITE_QUERY_REGEX.test(sql)) {
      return;
    }

    if (this.config.readOnly) {
      throw new DbOperationError('Write query blocked because DB client is in read-only mode', {
        metadata: { sqlPreview: previewSql(sql) }
      });
    }

    if (!this.config.writeAllowedEnvironments.includes(this.config.environment)) {
      throw new DbOperationError('Write query blocked in current environment', {
        metadata: {
          environment: this.config.environment,
          allowed: this.config.writeAllowedEnvironments
        }
      });
    }
  }

  private logSuccess(
    sql: string,
    params: readonly unknown[],
    durationMs: number,
    rowCount: number,
    options?: DbQueryOptions
  ): void {
    this.logger.debug('DB query completed', {
      operationName: options?.operationName,
      durationMs,
      rowCount,
      sqlPreview: previewSql(sql),
      params: maskSensitive(params)
    });
  }

  private mapError(
    error: unknown,
    sql: string,
    params: readonly unknown[],
    options?: DbQueryOptions
  ): DbOperationError {
    return new DbOperationError('Database operation failed', {
      cause: error,
      metadata: {
        operationName: options?.operationName,
        sqlPreview: previewSql(sql),
        params: maskSensitive(params)
      }
    });
  }
}

class TransactionDatabaseClient implements DatabaseClient {
  public constructor(
    private readonly client: PoolClient,
    private readonly config: DbConfig,
    private readonly logger: PlatformLogger
  ) {}

  public async queryOne<T>(
    sql: string,
    params: readonly unknown[],
    mapper?: (row: unknown) => T,
    options?: DbQueryOptions
  ): Promise<T | null> {
    const rows = await this.queryMany(sql, params, mapper, options);
    return rows[0] ?? null;
  }

  public async queryMany<T>(
    sql: string,
    params: readonly unknown[],
    mapper?: (row: unknown) => T,
    _options?: DbQueryOptions
  ): Promise<T[]> {
    ensureWriteAllowed(this.config, sql);

    const result = await this.client.query(sql, params as unknown[]);
    this.logger.debug('DB transaction query completed', {
      sqlPreview: previewSql(sql),
      rowCount: result.rowCount,
      params: maskSensitive(params)
    });

    return mapper
      ? result.rows.map((row) => mapper(row as QueryResultRow))
      : (result.rows as unknown as T[]);
  }

  public async scalar<T>(sql: string, params: readonly unknown[]): Promise<T | null> {
    const row = await this.queryOne<Record<string, unknown>>(sql, params);
    if (!row) {
      return null;
    }
    const key = Object.keys(row)[0];
    return (key ? (row[key] as T | undefined) : undefined) ?? null;
  }

  public async exists(sql: string, params: readonly unknown[]): Promise<boolean> {
    const scalar = await this.scalar(sql, params);
    return Boolean(scalar);
  }

  public async execute(sql: string, params: readonly unknown[]): Promise<number> {
    ensureWriteAllowed(this.config, sql);
    const result = await this.client.query(sql, params as unknown[]);
    return result.rowCount ?? 0;
  }

  public async transaction<T>(action: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const nested = new TransactionDatabaseClient(this.client, this.config, this.logger);
    return action(nested);
  }
}

const ensureWriteAllowed = (config: DbConfig, sql: string): void => {
  if (!WRITE_QUERY_REGEX.test(sql)) {
    return;
  }

  if (config.readOnly) {
    throw new DbOperationError('Write query blocked because DB client is in read-only mode', {
      metadata: { sqlPreview: previewSql(sql) }
    });
  }

  if (!config.writeAllowedEnvironments.includes(config.environment)) {
    throw new DbOperationError('Write query blocked in current environment', {
      metadata: {
        environment: config.environment,
        allowed: config.writeAllowedEnvironments
      }
    });
  }
};

const previewSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().slice(0, 300);
