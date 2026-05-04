# @automation-platform/queue-core

## Purpose

Provides in-memory queue primitives and waiters for local automation and showcase scenarios.

## Scope

- `InMemoryQueueClient` implements the queue contract.
- `QueueWaiter` polls for messages.
- `InMemoryDeadLetterQueueAdapter` demonstrates DLQ behavior.

## Non-goals

- Durable broker behavior.
- Kafka/SQS/RabbitMQ replacement.
- Persistence across process restarts.

## Public API

- `InMemoryQueueClient`
- `QueueWaiter`
- `DeadLetterQueueAdapter`
- `InMemoryDeadLetterQueueAdapter`

## Basic usage

```ts
import { InMemoryQueueClient, QueueWaiter } from '@automation-platform/queue-core';

const queue = new InMemoryQueueClient(logger);
await queue.publish({ queue: 'jobs', payload: { id: '1' }, correlationId: 'corr-1' });
const waiter = new QueueWaiter(queue, logger);
```

## Integration

Used by template and core showcase tests for async job examples.

## Configuration

Construct with a logger; wait operations accept timeout and interval options.

## Error handling

Timeouts and operation failures surface through platform queue errors where applicable.

## Testing

Covered by queue unit tests and API async showcase. Run `npm test`.

## Limitations

In-memory queues are suitable for local tests only.

## Extension points

Add broker-specific adapters behind the `QueueClient` contract.
