# @automation-platform/ui-flows

## Purpose

Provides simple reusable UI flow classes over component wrappers and the platform driver contract.

## Scope

- `AuthFlow` for login-like flows.
- `EntityCrudFlow`, `SearchFilterSortFlow`, `FileTransferFlow`, and `PermissionVisibilityFlow` as starter patterns.

## Non-goals

- Replacing project page objects.
- Owning selectors.
- Owning browser assertions.

## Public API

- `LoginFlowOptions`
- `AuthFlow`
- `EntityCrudFlowOptions`
- `EntityCrudFlow`
- `SearchFilterSortFlow`
- `FileTransferFlow`
- `PermissionVisibilityFlow`

## Basic usage

```ts
import { AuthFlow } from '@automation-platform/ui-flows';

const auth = new AuthFlow(ui, logger, 'auth');
await auth.login('demo', 'P@ssw0rd123', {
  usernameKey: 'username',
  passwordKey: 'password',
  submitKey: 'submit'
});
```

## Integration

Uses `UIDriver` selectors/actions and can be composed by `ui-core` or project-specific layers.

## Configuration

Flow constructors accept selector names and driver dependencies.

## Error handling

Underlying driver action errors are propagated.

## Testing

No dedicated unit tests yet; covered by typecheck.

## Limitations

Flows are starter patterns; real products should define clearer domain flows.

## Extension points

Add flows only when they remove real duplication across tests.
