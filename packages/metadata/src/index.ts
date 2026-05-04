import { z } from 'zod';
import type { Capability, CapabilityMap, TestMetadata } from '@automation-platform/contracts';

const metadataSchema = z.object({
  testId: z.string().min(1),
  title: z.string().min(1),
  feature: z.string().min(1),
  component: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  risk: z.enum(['minor', 'moderate', 'major', 'critical']),
  businessCriticality: z.enum(['p3', 'p2', 'p1', 'blocker']),
  owner: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  estimatedDurationMs: z.number().int().positive(),
  suite: z.enum(['smoke', 'regression', 'full']),
  capabilityRequirements: z
    .array(
      z.enum([
        'ui',
        'api',
        'db',
        'queue',
        'screenshots',
        'networkCapture',
        'consoleCapture',
        'fileUpload',
        'downloadHandling',
        'multiTab',
        'authViaApi',
        'authViaUi',
        'diagnostics',
        'cleanup',
        'plugins'
      ])
    )
    .optional(),
  environmentRequirements: z.array(z.string().min(1)).optional(),
  retryOverride: z
    .object({
      maxAttempts: z.number().int().positive().optional(),
      delayMs: z.number().int().nonnegative().optional(),
      backoffFactor: z.number().positive().optional()
    })
    .optional(),
  timeoutOverrideMs: z.number().int().positive().optional()
});

export type MetadataDeclaration = z.input<typeof metadataSchema>;

export const defineMetadata = (metadata: MetadataDeclaration): TestMetadata =>
  metadataSchema.parse(metadata);

export const validateMetadata = (metadata: unknown): TestMetadata => metadataSchema.parse(metadata);

export const metadataSupportsCapabilities = (
  metadata: TestMetadata,
  capabilityMap: CapabilityMap
): { supported: boolean; missing: Capability[] } => {
  const requested = metadata.capabilityRequirements ?? [];
  const missing = requested.filter((capability) => !capabilityMap[capability]);

  return {
    supported: missing.length === 0,
    missing
  };
};

export const metadataFor = (
  testId: string,
  title: string,
  patch: Omit<MetadataDeclaration, 'testId' | 'title'>
): TestMetadata =>
  defineMetadata({
    testId,
    title,
    ...patch
  });
