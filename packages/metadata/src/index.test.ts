import { describe, expect, it } from 'vitest';
import { defineMetadata, metadataSupportsCapabilities } from './index';

describe('metadata', () => {
  it('validates metadata declaration', () => {
    const metadata = defineMetadata({
      testId: 'T-1',
      title: 'Sample',
      feature: 'entities',
      component: 'table',
      severity: 'high',
      risk: 'major',
      businessCriticality: 'p1',
      owner: 'team',
      tags: ['smoke'],
      estimatedDurationMs: 12000,
      suite: 'smoke'
    });

    expect(metadata.testId).toBe('T-1');
  });

  it('finds missing capabilities', () => {
    const metadata = defineMetadata({
      testId: 'T-2',
      title: 'Queue scenario',
      feature: 'queue',
      component: 'worker',
      severity: 'medium',
      risk: 'moderate',
      businessCriticality: 'p2',
      owner: 'team',
      tags: ['regression'],
      estimatedDurationMs: 5000,
      suite: 'regression',
      capabilityRequirements: ['queue', 'db']
    });

    const result = metadataSupportsCapabilities(metadata, {
      queue: true,
      db: false
    });

    expect(result.supported).toBe(false);
    expect(result.missing).toEqual(['db']);
  });
});
