import { z } from 'zod';
import type {
  ResolvedSelector,
  SelectorCandidate,
  SelectorDefinition,
  SelectorRegistry,
  SelectorStrategy
} from '@automation-platform/contracts';
import { SelectorResolutionError } from '@automation-platform/utils';

const selectorCandidateSchema = z.object({
  strategy: z.enum(['css', 'xpath', 'text', 'testId']),
  value: z.string().min(1),
  weight: z.number().optional(),
  description: z.string().optional()
});

const selectorDefinitionSchema = z.object({
  namespace: z.string().min(1),
  key: z.string().min(1),
  candidates: z.array(selectorCandidateSchema).min(1),
  description: z.string().optional(),
  required: z.boolean().optional()
});

export type SelectorDefinitionInput = z.input<typeof selectorDefinitionSchema>;

export const validateSelectorDefinition = (
  definition: SelectorDefinitionInput | SelectorDefinition
): SelectorDefinition => {
  const normalizedInput: SelectorDefinitionInput = {
    ...definition,
    candidates: [...definition.candidates]
  };

  const parsed = selectorDefinitionSchema.parse(normalizedInput);
  return {
    ...parsed,
    candidates: [...parsed.candidates]
  };
};

export class NamespacedSelectorRegistry implements SelectorRegistry {
  private readonly selectors = new Map<string, SelectorDefinition>();

  public constructor(definitions: readonly SelectorDefinition[] = []) {
    definitions.forEach((definition) => this.register(definition));
  }

  public register(definition: SelectorDefinition): void {
    const key = this.buildKey(definition.namespace, definition.key);
    this.selectors.set(key, validateSelectorDefinition(definition));
  }

  public resolve(key: string, namespace = 'common'): SelectorDefinition | undefined {
    return this.selectors.get(this.buildKey(namespace, key));
  }

  public list(namespace?: string): readonly SelectorDefinition[] {
    const values = [...this.selectors.values()];
    if (!namespace) {
      return values;
    }
    return values.filter((definition) => definition.namespace === namespace);
  }

  public resolveOrThrow(
    key: string,
    namespace = 'common',
    preferredStrategies: readonly SelectorStrategy[] = ['testId', 'css', 'xpath', 'text']
  ): ResolvedSelector {
    const definition = this.resolve(key, namespace);
    if (!definition) {
      throw new SelectorResolutionError(`Selector not found: ${namespace}.${key}`, {
        metadata: { namespace, key }
      });
    }

    const candidate = resolveBestCandidate(definition, preferredStrategies);
    if (!candidate) {
      throw new SelectorResolutionError(`No candidates available for selector: ${namespace}.${key}`, {
        metadata: {
          namespace,
          key,
          preferredStrategies
        }
      });
    }

    return {
      namespace,
      key,
      candidate
    };
  }

  private buildKey(namespace: string, key: string): string {
    return `${namespace}::${key}`;
  }
}

export const resolveBestCandidate = (
  definition: SelectorDefinition,
  preferredStrategies: readonly SelectorStrategy[] = ['testId', 'css', 'xpath', 'text']
): SelectorCandidate | undefined => {
  const strategyScore = new Map<SelectorStrategy, number>();
  preferredStrategies.forEach((strategy, index) =>
    strategyScore.set(strategy, preferredStrategies.length - index)
  );

  return [...definition.candidates].sort((left, right) => {
    const rightScore = (strategyScore.get(right.strategy) ?? 0) + (right.weight ?? 0);
    const leftScore = (strategyScore.get(left.strategy) ?? 0) + (left.weight ?? 0);
    return rightScore - leftScore;
  })[0];
};

const withWeight = (
  strategy: SelectorStrategy,
  value: string,
  weight?: number
): SelectorCandidate => {
  const candidate: SelectorCandidate = {
    strategy,
    value
  };

  if (weight !== undefined) {
    candidate.weight = weight;
  }

  return candidate;
};

export const css = (value: string, weight?: number): SelectorCandidate =>
  withWeight('css', value, weight);

export const xpath = (value: string, weight?: number): SelectorCandidate =>
  withWeight('xpath', value, weight);

export const byText = (value: string, weight?: number): SelectorCandidate =>
  withWeight('text', value, weight);

export const byTestId = (value: string, weight?: number): SelectorCandidate =>
  withWeight('testId', value, weight);

export class SelectorBuilder {
  private readonly candidates: SelectorCandidate[] = [];

  public constructor(
    private readonly namespace: string,
    private readonly key: string,
    private readonly description?: string
  ) {}

  public withCss(value: string, weight?: number): this {
    this.candidates.push(css(value, weight));
    return this;
  }

  public withXpath(value: string, weight?: number): this {
    this.candidates.push(xpath(value, weight));
    return this;
  }

  public withText(value: string, weight?: number): this {
    this.candidates.push(byText(value, weight));
    return this;
  }

  public withTestId(value: string, weight?: number): this {
    this.candidates.push(byTestId(value, weight));
    return this;
  }

  public build(required = true): SelectorDefinition {
    const input: SelectorDefinitionInput = {
      namespace: this.namespace,
      key: this.key,
      candidates: this.candidates,
      required
    };

    if (this.description) {
      input.description = this.description;
    }

    return validateSelectorDefinition(input);
  }
}

export interface PlaywrightSelector {
  kind: 'css' | 'xpath' | 'text' | 'testId';
  value: string;
}

export const toPlaywrightSelector = (resolved: ResolvedSelector): PlaywrightSelector => {
  switch (resolved.candidate.strategy) {
    case 'css':
      return { kind: 'css', value: resolved.candidate.value };
    case 'xpath':
      return { kind: 'xpath', value: resolved.candidate.value };
    case 'testId':
      return { kind: 'testId', value: resolved.candidate.value };
    case 'text':
      return { kind: 'text', value: resolved.candidate.value };
    default:
      throw new SelectorResolutionError('Unsupported selector strategy', {
        metadata: {
          strategy: (resolved.candidate as SelectorCandidate).strategy
        }
      });
  }
};
