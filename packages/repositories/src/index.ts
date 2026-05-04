import type {
  ApiRepository,
  DatabaseClient,
  DbRepository,
  HttpClient,
  HttpRequest,
  PlatformLogger
} from '@automation-platform/contracts';
import { waitFor } from '@automation-platform/utils';

export interface EntityWithId<TId> {
  id: TId;
}

export abstract class BaseApiRepository<
  TEntity extends EntityWithId<TId>,
  TId
> implements ApiRepository<TEntity, TId> {
  protected constructor(
    protected readonly client: HttpClient,
    protected readonly basePath: string,
    protected readonly logger: PlatformLogger
  ) {}

  public async getById(id: TId): Promise<TEntity | null> {
    const response = await this.client.send<TEntity>({
      method: 'GET',
      path: `${this.basePath}/${String(id)}`
    });

    if (response.status === 404) {
      return null;
    }

    return response.data;
  }

  public async create(payload: Partial<TEntity>): Promise<TEntity> {
    const response = await this.client.send<TEntity, Partial<TEntity>>({
      method: 'POST',
      path: this.basePath,
      body: payload
    });
    return response.data;
  }

  public async update(id: TId, payload: Partial<TEntity>): Promise<TEntity> {
    const response = await this.client.send<TEntity, Partial<TEntity>>({
      method: 'PUT',
      path: `${this.basePath}/${String(id)}`,
      body: payload
    });
    return response.data;
  }

  public async delete(id: TId): Promise<void> {
    await this.client.send({
      method: 'DELETE',
      path: `${this.basePath}/${String(id)}`
    });
  }
}

export abstract class BaseDbRepository<
  TEntity extends EntityWithId<TId>,
  TId
> implements DbRepository<TEntity, TId> {
  protected constructor(
    protected readonly db: DatabaseClient,
    protected readonly logger: PlatformLogger,
    protected readonly tableName: string,
    protected readonly mapRow: (row: unknown) => TEntity
  ) {}

  public async findById(id: TId): Promise<TEntity | null> {
    return this.db.queryOne(`select * from ${this.tableName} where id = $1`, [id], this.mapRow, {
      operationName: `${this.tableName}.findById`
    });
  }

  public abstract save(entity: TEntity): Promise<TEntity>;

  public async remove(id: TId): Promise<void> {
    await this.db.execute(`delete from ${this.tableName} where id = $1`, [id], {
      operationName: `${this.tableName}.remove`
    });
  }
}

export interface TemplateEntity {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  createdAtIso: string;
}

const mapTemplateEntity = (row: unknown): TemplateEntity => {
  const value = row as Record<string, unknown>;
  return {
    id: String(value.id),
    name: String(value.name),
    status: value.status as TemplateEntity['status'],
    createdAtIso: String(value.created_at_iso ?? value.createdatiso ?? value.createdAtIso)
  };
};

export class TemplateApiRepository extends BaseApiRepository<TemplateEntity, string> {
  public constructor(client: HttpClient, logger: PlatformLogger) {
    super(client, '/entities', logger);
  }

  public async createMinimalValid(name: string): Promise<TemplateEntity> {
    return this.create({ name, status: 'draft' });
  }

  public async createDraftLike(patch: Partial<TemplateEntity> = {}): Promise<TemplateEntity> {
    return this.create({
      name: patch.name ?? `Draft-${Date.now()}`,
      status: patch.status ?? 'draft'
    });
  }

  public async deleteIfExists(id: string): Promise<void> {
    const entity = await this.getById(id);
    if (entity) {
      await this.delete(id);
    }
  }

  public async existsById(id: string): Promise<boolean> {
    const entity = await this.getById(id);
    return entity !== null;
  }

  public async waitUntilStatus(
    id: string,
    expected: TemplateEntity['status'],
    options: { timeoutMs: number; pollingIntervalMs: number }
  ): Promise<TemplateEntity> {
    return waitFor(
      async () => {
        const entity = await this.getById(id);
        if (!entity) {
          return undefined;
        }
        return entity.status === expected ? entity : undefined;
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: `entity ${id} status ${expected}`
      }
    );
  }

  public buildRequestForId(id: string): HttpRequest {
    return {
      method: 'GET',
      path: `${this.basePath}/${id}`
    };
  }
}

export class TemplateDbRepository extends BaseDbRepository<TemplateEntity, string> {
  public constructor(db: DatabaseClient, logger: PlatformLogger) {
    super(db, logger, 'template_entities', mapTemplateEntity);
  }

  public async save(entity: TemplateEntity): Promise<TemplateEntity> {
    await this.db.execute(
      `
      insert into template_entities(id, name, status, created_at_iso)
      values ($1, $2, $3, $4)
      on conflict(id)
      do update set name = excluded.name, status = excluded.status
      `,
      [entity.id, entity.name, entity.status, entity.createdAtIso],
      { operationName: 'template_entities.save' }
    );

    const stored = await this.findById(entity.id);
    if (!stored) {
      throw new Error('Entity was not found after save');
    }
    return stored;
  }

  public async createMinimalValid(name: string): Promise<TemplateEntity> {
    const entity: TemplateEntity = {
      id: `db-${Date.now()}`,
      name,
      status: 'draft',
      createdAtIso: new Date().toISOString()
    };

    return this.save(entity);
  }

  public async createDraftLike(patch: Partial<TemplateEntity> = {}): Promise<TemplateEntity> {
    return this.save({
      id: patch.id ?? `db-${Date.now()}`,
      name: patch.name ?? `db-draft-${Date.now()}`,
      status: patch.status ?? 'draft',
      createdAtIso: patch.createdAtIso ?? new Date().toISOString()
    });
  }

  public async deleteIfExists(id: string): Promise<void> {
    const exists = await this.existsById(id);
    if (exists) {
      await this.remove(id);
    }
  }

  public async existsById(id: string): Promise<boolean> {
    return this.db.exists('select exists(select 1 from template_entities where id = $1)', [id], {
      operationName: 'template_entities.existsById'
    });
  }

  public async waitUntilStatus(
    id: string,
    expected: TemplateEntity['status'],
    options: { timeoutMs: number; pollingIntervalMs: number }
  ): Promise<TemplateEntity> {
    return waitFor(
      async () => {
        const entity = await this.findById(id);
        if (!entity) {
          return undefined;
        }
        return entity.status === expected ? entity : undefined;
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: `db entity ${id} status ${expected}`
      }
    );
  }
}
