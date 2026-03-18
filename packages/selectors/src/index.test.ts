import { describe, expect, it } from 'vitest';
import {
  NamespacedSelectorRegistry,
  SelectorBuilder,
  resolveBestCandidate,
  toPuppeteerSelector
} from './index';

describe('selectors', () => {
  it('resolves best candidate by strategy priority', () => {
    const selector = new SelectorBuilder('demo', 'submit')
      .withXpath('//button')
      .withTestId('submit-button')
      .build();

    const best = resolveBestCandidate(selector);
    expect(best?.strategy).toBe('testId');
  });

  it('resolves namespaced selectors and converts to puppeteer', () => {
    const registry = new NamespacedSelectorRegistry([
      new SelectorBuilder('demo', 'search').withTestId('search-input').withCss('#search').build()
    ]);

    const resolved = registry.resolveOrThrow('search', 'demo');
    const puppeteer = toPuppeteerSelector(resolved);

    expect(puppeteer.kind).toBe('css');
    expect(puppeteer.value).toContain('data-testid');
  });
});
