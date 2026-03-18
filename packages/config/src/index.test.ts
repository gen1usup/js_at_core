import { describe, expect, it } from 'vitest';
import { loadPlatformConfig, validateConfig } from './index';

describe('config', () => {
  it('loads and merges env overrides', () => {
    const config = loadPlatformConfig({
      env: {
        AP_PROJECT_NAME: 'demo',
        AP_BASE_URL: 'https://example.com',
        AP_DB_ENABLED: 'true',
        AP_DB_READ_ONLY: 'false',
        AP_DB_WRITE_ENVS: 'qa,staging',
        AP_ENV: 'qa',
        AP_QUEUE_ENABLED: 'true'
      }
    });

    expect(config.projectName).toBe('demo');
    expect(config.db.enabled).toBe(true);
    expect(config.db.readOnly).toBe(false);
    expect(config.db.writeAllowedEnvironments).toEqual(['qa', 'staging']);
    expect(config.queue.enabled).toBe(true);
  });

  it('fails fast on invalid config', () => {
    expect(() =>
      validateConfig({
        projectName: 'x'
      })
    ).toThrow();
  });
});
