# @automation-platform/governance

## Purpose

Validates automation conventions such as selector quality, metadata completeness, naming, config quality, and hard sleep usage.

## Scope

- Selector checks.
- Metadata/config quality checks.
- Repo-level governance audit.

## Non-goals

- Security scanning.
- Replacing ESLint.
- Business rule enforcement.

## Public API

- `GovernanceIssue`
- `GovernanceReport`
- `validateSelectorQuality`
- `validateMetadataQuality`
- `validateConfigQuality`
- `validateName`
- `detectHardSleepUsage`
- `buildValidationResult`
- `runGovernanceAudit`

## Basic usage

```ts
import { runGovernanceAudit } from '@automation-platform/governance';

const report = await runGovernanceAudit(process.cwd());
if (!report.passed) console.error(report.issues);
```

## Integration

Root `npm run governance:validate` calls this package through `scripts/validate-governance.ts`.

## Configuration

Runs against a root directory and source files.

## Error handling

Returns structured issues for validation failures.

## Testing

Covered by governance unit tests and `npm run governance:validate`.

## Limitations

Rules are intentionally small and repository-specific.

## Extension points

Add focused checks with tests and avoid broad false positives.
