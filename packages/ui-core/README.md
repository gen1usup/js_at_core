# @automation-platform/ui-core

## Purpose

Composes UI driver, selectors, components, and flows into a small platform UI facade.

## Scope

- `UICore` owns access to driver and UI collaborators.
- `UICoreOptions` defines required collaborators.

## Non-goals

- Browser test running.
- Replacing Playwright Test.
- Owning page objects.

## Public API

- `UICoreOptions`
- `UICore`

## Basic usage

```ts
import { UICore } from '@automation-platform/ui-core';
import { NamespacedSelectorRegistry, SelectorBuilder } from '@automation-platform/selectors';

const selectors = new NamespacedSelectorRegistry([
  new SelectorBuilder('auth', 'submit').withTestId('login-submit').build()
]);
const ui = new UICore({ driver, selectors, logger });
await ui.click('submit', 'auth');
```

## Integration

Sits above `ui-driver`, `selectors`, `ui-components`, and `ui-flows` for contract-based UI scenarios.

## Configuration

Requires explicit collaborators; no global singleton is created.

## Error handling

Propagates collaborator errors.

## Testing

No dedicated unit tests yet; covered by typecheck.

## Limitations

Use raw Playwright Test for browser-first assertions and artifacts.

## Extension points

Add project-specific UI composition outside this package before expanding the generic facade.
