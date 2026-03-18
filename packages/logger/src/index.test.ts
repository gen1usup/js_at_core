import { describe, expect, it } from 'vitest';
import { sanitizeLogMeta } from './index';

describe('logger', () => {
  it('masks sensitive values', () => {
    const masked = sanitizeLogMeta({
      password: 'secret-password',
      token: 'token-12345',
      nested: {
        authorization: 'Bearer x'
      }
    });

    expect(String(masked?.password)).toContain('***');
    expect(String(masked?.token)).toContain('***');
    expect(String((masked?.nested as Record<string, unknown>).authorization)).toContain('***');
  });
});
