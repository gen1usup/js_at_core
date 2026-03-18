import { z } from 'zod';
import type { CleanupRegistry, ExecutionContext, ResourceRegistry } from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';

export const seedConfigSchema = z.object({
  seed: z.number().int().nonnegative().default(1)
});

const mulberry32 = (seed: number): (() => number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class DeterministicDataGenerator {
  private readonly random: () => number;

  public constructor(seed = 1) {
    this.random = mulberry32(seed);
  }

  public int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  public pick<T>(items: readonly T[]): T {
    const index = this.int(0, items.length - 1);
    return items[index] as T;
  }

  public string(prefix: string, length = 8): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let value = prefix;
    for (let i = 0; i < length; i += 1) {
      value += alphabet[this.int(0, alphabet.length - 1)];
    }
    return value;
  }
}

export class DataBuilder<T extends object> {
  private state: T;

  public constructor(initial: T) {
    this.state = { ...initial };
  }

  public with(patch: Partial<T>): DataBuilder<T> {
    this.state = {
      ...this.state,
      ...patch
    };
    return this;
  }

  public build(): T {
    return { ...this.state };
  }
}

export class PresetFactory<T extends object> {
  private readonly presets = new Map<string, T>();

  public register(name: string, value: T): void {
    this.presets.set(name, value);
  }

  public create(name: string, patch: Partial<T> = {}): T {
    const base = this.presets.get(name);
    if (!base) {
      throw new Error(`Preset not found: ${name}`);
    }
    return {
      ...base,
      ...patch
    };
  }

  public names(): string[] {
    return [...this.presets.keys()];
  }
}

export interface Snapshot<T> {
  before: T;
  after: T;
  diff: Record<string, { before: unknown; after: unknown }>;
}

export const createSnapshotDiff = <T extends Record<string, unknown>>(
  before: T,
  after: T
): Snapshot<T> => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  keys.forEach((key) => {
    if (before[key] !== after[key]) {
      diff[key] = {
        before: before[key],
        after: after[key]
      };
    }
  });

  return {
    before,
    after,
    diff
  };
};

export interface SeedHelper<TSeedInput> {
  name: string;
  seed(input: TSeedInput): Promise<void>;
}

export class LifecycleEntitySupport {
  public constructor(
    private readonly cleanup: CleanupRegistry,
    private readonly resources: ResourceRegistry,
    private readonly logger: PlatformLogger
  ) {}

  public registerEntity(
    params: {
      id: string;
      type: string;
      payload: unknown;
      cleanup: () => Promise<void>;
    }
  ): void {
    this.resources.register({
      id: params.id,
      type: params.type,
      value: params.payload,
      createdAt: new Date()
    });

    this.cleanup.add({
      id: `cleanup:${params.type}:${params.id}`,
      description: `Cleanup ${params.type} ${params.id}`,
      run: async () => {
        await params.cleanup();
        this.logger.info('Entity cleaned up', {
          id: params.id,
          type: params.type
        });
      }
    });
  }

  public static fromContext(context: ExecutionContext): LifecycleEntitySupport {
    return new LifecycleEntitySupport(context.cleanup, context.resources, context.logger);
  }
}

export interface TemplateEntity {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  createdAtIso: string;
}

export const templateEntityBuilder = (generator: DeterministicDataGenerator): DataBuilder<TemplateEntity> =>
  new DataBuilder<TemplateEntity>({
    id: `ent-${generator.int(1000, 9999)}`,
    name: generator.string('entity-'),
    status: 'draft',
    createdAtIso: new Date().toISOString()
  });
