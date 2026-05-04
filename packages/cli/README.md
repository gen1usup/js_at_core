# @automation-platform/cli

## Purpose

Provides a small Commander-based CLI for starter-kit scaffolding and validation entry points.

## Scope

- `buildCli` creates the command tree.
- `runCli` executes it from argv.
- Scaffold templates live in this package.

## Non-goals

- Large project generation.
- Package publishing.
- Replacing npm scripts.

## Public API

- `buildCli`
- `runCli`

## Basic usage

```ts
import { buildCli } from '@automation-platform/cli';

const program = buildCli();
program.parse(['node', 'automation-platform', '--help']);
```

## Integration

Uses shared contracts for project adapter shapes and complements root scripts.

## Configuration

Driven by command arguments; no separate CLI config exists today.

## Error handling

Commander handles command validation and `runCli` owns process-level errors.

## Testing

No dedicated CLI tests yet; covered by `npm run typecheck`.

## Limitations

Scaffold output is minimal and should be reviewed before use.

## Extension points

Add new commands through `buildCli` and keep generated imports aligned with real exports.
