# @automation-platform/plugins

## Purpose

Provides a minimal plugin manager and diagnostics report plugin plus contracts for future optional integrations.

## Scope

- `PluginManager` registers plugins and runs hooks.
- `DiagnosticsReportPlugin` persists diagnostics bundles.
- Accessibility, visual, and AI exports are contracts/placeholders.

## Non-goals

- Plugin marketplace behavior.
- Dynamic package loading.
- Accessibility or visual testing engines.

## Public API

- `PluginManager`
- `DiagnosticsReportPluginOptions`
- `DiagnosticsReportPlugin`
- `AccessibilityPluginContract`
- `VisualRegressionPluginContract`
- `AIPluginContract`
- `createCustomProjectPlugin`

## Basic usage

```ts
import { DiagnosticsReportPlugin, PluginManager } from '@automation-platform/plugins';

const manager = new PluginManager(context.logger);
manager.register(new DiagnosticsReportPlugin({ outputDir: 'artifacts/plugins/example' }));
await manager.runHook('onDiagnostics', context, {
  executionId: context.executionId,
  diagnostics: bundle
});
```

## Integration

Used by diagnostics showcase to persist JSON report artifacts.

## Configuration

`DiagnosticsReportPlugin` needs an output directory.

## Error handling

Plugin hook errors currently propagate to the caller.

## Testing

Covered by `projects/core-showcase-tests/tests/diagnostics-artifacts.test.ts`. Run `npm test`.

## Limitations

Only diagnostics report persistence has a concrete implementation today.

## Extension points

Implement `PlatformPlugin` hooks explicitly and register them through `PluginManager`.
