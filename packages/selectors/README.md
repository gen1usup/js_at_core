# @automation-platform/selectors

## Purpose

Defines selector registry, selector candidates, scoring, builder helpers, and Playwright selector conversion.

## Scope

- `NamespacedSelectorRegistry` stores selector definitions.
- `SelectorBuilder` builds candidates.
- `toPlaywrightSelector` converts resolved selectors.

## Non-goals

- Executing browser actions.
- Replacing Playwright locators.
- Encouraging brittle selectors.

## Public API

- `SelectorDefinitionInput`
- `validateSelectorDefinition`
- `NamespacedSelectorRegistry`
- `resolveBestCandidate`
- `css`
- `xpath`
- `byText`
- `byTestId`
- `SelectorBuilder`
- `PlaywrightSelector`
- `toPlaywrightSelector`

## Basic usage

```ts
import {
  NamespacedSelectorRegistry,
  SelectorBuilder,
  toPlaywrightSelector
} from '@automation-platform/selectors';

const registry = new NamespacedSelectorRegistry([
  new SelectorBuilder('auth', 'submit').withTestId('login-submit', 10).withText('Login').build()
]);
const resolved = registry.resolveOrThrow('submit', 'auth');
const selector = toPlaywrightSelector(resolved);
```

## Integration

Used by UI abstractions and governance tests to keep selectors inspectable.

## Configuration

Selector definitions include namespace, name, strategy, value, and weight.

## Error handling

Invalid definitions fail schema validation; unresolved candidates throw selector errors.

## Testing

Covered by selector unit tests and governance checks. Run `npm test`.

## Limitations

Prefer Playwright role/label/text locators directly in e2e tests when possible.

## Extension points

Add strategies only when they map cleanly to platform contracts and Playwright usage.
