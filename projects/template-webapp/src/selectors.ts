import { NamespacedSelectorRegistry, SelectorBuilder } from '@automation-platform/selectors';

const selectors = [
  new SelectorBuilder('auth', 'username').withTestId('auth-username').withCss('#username').build(),
  new SelectorBuilder('auth', 'password').withTestId('auth-password').withCss('#password').build(),
  new SelectorBuilder('auth', 'submit').withTestId('auth-submit').withCss('button[type="submit"]').build(),
  new SelectorBuilder('auth', 'logout').withTestId('auth-logout').withCss('#logout').build(),

  new SelectorBuilder('entity', 'create').withTestId('entity-create').withCss('#create').build(),
  new SelectorBuilder('entity', 'name').withTestId('entity-name').withCss('#name').build(),
  new SelectorBuilder('entity', 'status').withTestId('entity-status').withCss('#status').build(),
  new SelectorBuilder('entity', 'submit').withTestId('entity-submit').withCss('#submit').build(),
  new SelectorBuilder('entity', 'toast').withTestId('entity-toast').withCss('.toast').build(),

  new SelectorBuilder('search', 'search.query').withTestId('search-query').withCss('#query').build(),
  new SelectorBuilder('search', 'search.submit').withTestId('search-submit').withCss('#search').build(),
  new SelectorBuilder('search', 'search.sort').withTestId('search-sort').withCss('#sort').build(),
  new SelectorBuilder('search', 'filters.apply').withTestId('filters-apply').withCss('#apply').build(),
  new SelectorBuilder('search', 'filters.reset').withTestId('filters-reset').withCss('#reset').build()
];

export const templateSelectorRegistry = new NamespacedSelectorRegistry(selectors);
