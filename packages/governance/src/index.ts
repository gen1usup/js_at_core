import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { CliValidationResult, SelectorDefinition, TestMetadata } from '@automation-platform/contracts';
import { validateConfig, type PlatformConfig } from '@automation-platform/config';
import { validateMetadata } from '@automation-platform/metadata';
import { validateSelectorDefinition } from '@automation-platform/selectors';

export interface GovernanceIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  source?: string;
}

export interface GovernanceReport {
  valid: boolean;
  issues: GovernanceIssue[];
}

const camelCaseSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);

export const validateSelectorQuality = (selectors: readonly SelectorDefinition[]): GovernanceIssue[] => {
  const issues: GovernanceIssue[] = [];

  selectors.forEach((selector) => {
    const parsed = validateSelectorDefinition({
      ...selector,
      candidates: [...selector.candidates]
    });

    if (parsed.candidates.length < 2) {
      issues.push({
        level: 'warning',
        code: 'SELECTOR_NO_FALLBACK',
        message: `Selector ${selector.namespace}.${selector.key} has no fallback candidate`
      });
    }

    const strategies = new Set(parsed.candidates.map((candidate) => candidate.strategy));
    if (!strategies.has('testId') && !strategies.has('css')) {
      issues.push({
        level: 'warning',
        code: 'SELECTOR_WEAK_STRATEGY',
        message: `Selector ${selector.namespace}.${selector.key} should include testId or css strategy`
      });
    }
  });

  return issues;
};

export const validateMetadataQuality = (metadata: TestMetadata): GovernanceIssue[] => {
  const issues: GovernanceIssue[] = [];
  validateMetadata(metadata);

  if (metadata.tags.length === 0) {
    issues.push({
      level: 'warning',
      code: 'METADATA_TAGS_EMPTY',
      message: `Metadata ${metadata.testId} has no tags`
    });
  }

  if (metadata.estimatedDurationMs > 300_000) {
    issues.push({
      level: 'warning',
      code: 'METADATA_DURATION_HIGH',
      message: `Metadata ${metadata.testId} has high estimated duration`
    });
  }

  return issues;
};

export const validateConfigQuality = (config: PlatformConfig): GovernanceIssue[] => {
  const parsed = validateConfig(config);
  const issues: GovernanceIssue[] = [];

  if (!parsed.capabilities.diagnostics) {
    issues.push({
      level: 'warning',
      code: 'CONFIG_DIAGNOSTICS_DISABLED',
      message: 'Diagnostics capability is disabled'
    });
  }

  if (parsed.timeouts.uiWaitMs < 1000) {
    issues.push({
      level: 'warning',
      code: 'CONFIG_TIMEOUT_LOW',
      message: 'UI wait timeout is suspiciously low'
    });
  }

  return issues;
};

export const validateName = (
  name: string,
  target: 'selector' | 'component' | 'flow'
): GovernanceIssue[] => {
  if (camelCaseSchema.safeParse(name).success) {
    return [];
  }

  return [
    {
      level: 'error',
      code: 'NAMING_RULE',
      message: `${target} name "${name}" must be camelCase`
    }
  ];
};

export const detectHardSleepUsage = (content: string, source?: string): GovernanceIssue[] => {
  const forbiddenPatterns = [/setTimeout\s*\(/, /waitForTimeout\s*\(/, /sleep\s*\(/];
  const issues: GovernanceIssue[] = [];

  forbiddenPatterns.forEach((pattern) => {
    if (!pattern.test(content)) {
      return;
    }

    const issue: GovernanceIssue = {
      level: 'warning',
      code: 'NO_HARD_SLEEP_POLICY',
      message: 'Hard sleep usage detected; prefer retry/wait utilities'
    };

    if (source) {
      issue.source = source;
    }

    issues.push(issue);
  });

  return issues;
};

export const buildValidationResult = (issues: GovernanceIssue[]): CliValidationResult => ({
  valid: issues.every((issue) => issue.level !== 'error'),
  errors: issues.filter((issue) => issue.level === 'error').map((issue) => issue.message),
  warnings: issues.filter((issue) => issue.level === 'warning').map((issue) => issue.message)
});

export const runGovernanceAudit = async (rootDir: string): Promise<GovernanceReport> => {
  const files = await collectTypeScriptFiles(rootDir);
  const issues: GovernanceIssue[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    issues.push(...detectHardSleepUsage(content, filePath));
  }

  return {
    valid: issues.every((issue) => issue.level !== 'error'),
    issues
  };
};

const collectTypeScriptFiles = async (rootDir: string): Promise<string[]> => {
  const output: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && full.endsWith('.ts')) {
        output.push(full);
      }
    }
  }

  return output;
};
