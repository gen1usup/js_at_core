import { describe, expect, it } from 'vitest';
import { detectHardSleepUsage, validateName } from './index';

describe('governance', () => {
  it('detects hard sleep policy violations', () => {
    const issues = detectHardSleepUsage('await page.waitForTimeout(1000);', 'a.ts');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('enforces camelCase naming', () => {
    const issues = validateName('Bad-Name', 'component');
    expect(issues[0]?.level).toBe('error');
  });
});
