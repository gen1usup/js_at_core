# @automation-platform/metadata

## Purpose

Defines and validates test metadata used for governance, reporting context, and capability checks.

## Scope

- `defineMetadata` validates declarations.
- `validateMetadata` parses unknown input.
- `metadataSupportsCapabilities` checks runtime capability fit.

## Non-goals

- External metadata storage.
- Report generation.
- Test execution.

## Public API

- `MetadataDeclaration`
- `defineMetadata`
- `validateMetadata`
- `metadataSupportsCapabilities`
- `metadataFor`

## Basic usage

```ts
import { defineMetadata, metadataSupportsCapabilities } from '@automation-platform/metadata';

const metadata = defineMetadata({
  testId: 'api-001',
  title: 'API health',
  feature: 'api',
  component: 'health',
  severity: 'medium',
  risk: 'moderate',
  businessCriticality: 'p2',
  owner: 'qa',
  tags: ['api'],
  estimatedDurationMs: 30000,
  suite: 'smoke',
  capabilityRequirements: ['api']
});

metadataSupportsCapabilities(metadata, { api: true });
```

## Integration

Used by execution context, governance, and showcase tests.

## Configuration

Metadata is provided in code as declarations.

## Error handling

Invalid declarations fail zod validation.

## Testing

Covered by metadata unit tests and governance tests. Run `npm test`.

## Limitations

The taxonomy is starter-kit level and may evolve.

## Extension points

Add fields through the schema and update governance/docs together.
