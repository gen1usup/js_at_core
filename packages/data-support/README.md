# @automation-platform/data-support

## Purpose

Provides deterministic test data helpers, builders, presets, snapshots, and lifecycle cleanup helpers.

## Scope

- Seeded data generation.
- Generic builders and presets.
- Snapshot diffing and lifecycle cleanup support.

## Non-goals

- Persistence.
- Domain-specific fixtures.
- API or DB transport.

## Public API

- `seedConfigSchema`
- `DeterministicDataGenerator`
- `DataBuilder`
- `PresetFactory`
- `Snapshot`
- `createSnapshotDiff`
- `SeedHelper`
- `LifecycleEntitySupport`
- `TemplateEntity`
- `templateEntityBuilder`

## Basic usage

```ts
import {
  DeterministicDataGenerator,
  templateEntityBuilder
} from '@automation-platform/data-support';

const generator = new DeterministicDataGenerator(42);
const entity = templateEntityBuilder(generator).with({ status: 'draft' }).build();
```

## Integration

Used by core showcase tests for repeatable data and cleanup examples.

## Configuration

Seeded generation accepts seed config; builders accept local defaults.

## Error handling

Builder misuse surfaces as normal TypeScript or runtime errors.

## Testing

Covered by core showcase tests and `npm run typecheck`.

## Limitations

Template entity is illustrative, not a domain model.

## Extension points

Add project-specific builders in project packages and reuse generic primitives.
