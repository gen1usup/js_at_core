import type { ExecutionContext } from '@automation-platform/contracts';
import { QueueWaiter } from '@automation-platform/queue-core';
import type { QueueClient } from '@automation-platform/contracts';
import type { TemplateWebGateway } from './gateway';

export interface QueueAwareScenarioInput {
  gateway: TemplateWebGateway;
  queueClient: QueueClient;
  context: ExecutionContext;
  queueName?: string;
}

export const runQueueAwareScenario = async (
  input: QueueAwareScenarioInput
): Promise<{ entityId: string; queueMessageId: string }> => {
  const created = await input.gateway.create({
    name: `entity-${Date.now()}`,
    cleanupViaApi: true
  });

  const queueName = input.queueName ?? 'entity-events';
  await input.queueClient.publish({
    queue: queueName,
    payload: {
      entityId: created.id,
      status: 'active'
    },
    correlationId: input.context.correlationId
  });

  const waiter = new QueueWaiter(input.queueClient, input.context.logger);
  const message = await waiter.waitForCorrelation(queueName, input.context.correlationId, {
    timeoutMs: 6_000,
    pollingIntervalMs: 200
  });

  await input.queueClient.acknowledge(queueName, message.id);

  return {
    entityId: created.id,
    queueMessageId: message.id
  };
};
