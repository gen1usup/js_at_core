# @automation-platform/config

## Purpose

Loads and validates platform configuration from defaults, environment variables, and project overrides.

## Scope

- `loadPlatformConfig` merges inputs.
- `validateConfig` checks schema validity.
- `maskConfig` prepares safe logging output.

## Non-goals

- Remote config.
- Secret management.
- Starting services.

## Public API

- `PlatformConfig`
- `PlatformConfigInput`
- `ConfigLoaderOptions`
- `validateConfig`
- `loadPlatformConfig`
- `getCapabilityMap`
- `getFeatureFlags`
- `maskConfig`
- `defaultConfig`

## Basic usage

```ts
import { loadPlatformConfig } from '@automation-platform/config';

const config = loadPlatformConfig({
  env: { AP_BASE_URL: 'http://127.0.0.1:3010', AP_API_ENABLED: 'true' }
});

console.log(config.api.baseUrl);
```

## Integration

Used by showcase tests to configure API, queue, diagnostics, feature flags, and capabilities.

## Configuration

Reads `AP_*` values and optional project overrides.

## Error handling

Invalid input fails schema validation before runtime use.

## Testing

Covered by `packages/config/src/index.test.ts` and `npm run config:validate`.

## Limitations

Config is local and static for a process.

## Extension points

Add fields with defaults, tests, and docs in the same change.
