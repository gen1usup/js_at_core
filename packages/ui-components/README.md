# @automation-platform/ui-components

## Purpose

Provides lightweight typed component wrappers over the platform UI driver contract.

## Scope

- Button, input, checkbox, table, modal, tabs, pagination, and other wrappers.
- `ComponentFactory` centralizes wrapper creation.

## Non-goals

- Rendering UI.
- Replacing a design system.
- Replacing Playwright locators in e2e tests.

## Public API

- `ButtonComponent`
- `InputComponent`
- `TextareaComponent`
- `CheckboxComponent`
- `RadioComponent`
- `SelectComponent`
- `TableComponent`
- `GridComponent`
- `ModalComponent`
- `DrawerComponent`
- `ToastComponent`
- `TabsComponent`
- `PaginationComponent`
- `HeaderComponent`
- `SidebarComponent`
- `FileUploaderComponent`
- `FilterPanelComponent`
- `DatePickerComponent`
- `LoaderComponent`
- `ComponentFactoryOptions`
- `ComponentFactory`

## Basic usage

```ts
import { ComponentFactory } from '@automation-platform/ui-components';

const components = new ComponentFactory({ ui, logger, namespace: 'auth' });
await components.button('login.submit').click();
```

## Integration

Depends on `UIDriver` and selector names for platform-level UI abstractions.

## Configuration

Construct with a `UIDriver` implementation and optional naming conventions.

## Error handling

Errors come from the underlying driver actions.

## Testing

No dedicated unit tests yet; covered by typecheck and UI contract usage.

## Limitations

Wrappers are intentionally thin and should not hide important browser assertions.

## Extension points

Add project-specific components when domain semantics matter.
