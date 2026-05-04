# @automation-platform/selectors

## Purpose

Selector definitions, registry, fallback resolution and Playwright conversion.

## Scope

- Provides the public API listed below.
- Stays focused on its package responsibility inside the automation starter kit.
- Is designed to be composed with other packages instead of owning complete scenarios alone.

## Non-goals

- Does not replace a test runner.
- Does not introduce project-specific business logic.
- Does not claim production readiness beyond the tests and CI in this repository.

## Public API

- NamespacedSelectorRegistry
- SelectorBuilder
- css
- xpath
- byText
- byTestId
- toPlaywrightSelector

## Basic usage

```ts
import { NamespacedSelectorRegistry } from '@automation-platform/selectors';

const selector = new SelectorBuilder('login', 'submit')
  .withTestId('submit')
  .withCss('#submit')
  .build();
```

## Integration

- Used through workspace imports by tests, examples or neighboring packages.
- Prefer depending on shared contracts when crossing package boundaries.
- See the root README showcase matrix for concrete usage paths.

## Configuration

- Most options are passed explicitly by constructor/function input.
- Environment-level settings are handled by @automation-platform/config when needed.
- This package does not require secrets directly unless the caller passes them into its own config.

## Error handling

- Errors are surfaced to callers instead of being swallowed.
- Shared platform error classes from @automation-platform/utils are used where this package owns the failure mode.
- Callers should add scenario-level diagnostics/cleanup through execution and diagnostics packages.

## Testing

packages/selectors/src/index.test.ts

## Limitations

No DOM querying by itself; browser interaction is in ui-driver.

## Extension points

- Extend by adding narrow functions/classes with tests.
- Keep app-specific behavior in projects/\* unless it is truly reusable.
- Avoid broad abstractions until at least two real scenarios need them.
