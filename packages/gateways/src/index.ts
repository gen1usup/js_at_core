import type { ExecutionContext } from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import { LifecycleEntitySupport } from '@automation-platform/data-support';
import { QueueWaiter } from '@automation-platform/queue-core';
import type { QueueClient } from '@automation-platform/contracts';
import type {
  TemplateApiRepository,
  TemplateDbRepository,
  TemplateEntity
} from '@automation-platform/repositories';

export interface CreateEntityCommand {
  name: string;
  cleanupViaApi?: boolean;
}

export interface UpdateStatusCommand {
  id: string;
  status: TemplateEntity['status'];
}

export class TemplateEntityGateway {
  private readonly entitySupport: LifecycleEntitySupport;
  private readonly queueWaiter: QueueWaiter;

  public constructor(
    private readonly apiRepository: TemplateApiRepository,
    private readonly dbRepository: TemplateDbRepository,
    private readonly queueClient: QueueClient,
    private readonly context: ExecutionContext,
    private readonly logger: PlatformLogger
  ) {
    this.entitySupport = LifecycleEntitySupport.fromContext(context);
    this.queueWaiter = new QueueWaiter(queueClient, logger);
  }

  public async create(command: CreateEntityCommand): Promise<TemplateEntity> {
    const created = await this.apiRepository.createMinimalValid(command.name);

    this.entitySupport.registerEntity({
      id: created.id,
      type: 'template-entity',
      payload: created,
      cleanup: async () => {
        if (command.cleanupViaApi ?? true) {
          await this.apiRepository.deleteIfExists(created.id);
        } else {
          await this.dbRepository.deleteIfExists(created.id);
        }
      }
    });

    this.logger.info('TemplateEntityGateway created entity', {
      id: created.id,
      status: created.status
    });

    return created;
  }

  public async activateAndWaitForBackgroundProcessing(
    command: UpdateStatusCommand,
    options: { queueName: string; timeoutMs: number }
  ): Promise<TemplateEntity> {
    await this.apiRepository.update(command.id, { status: command.status });

    const queueMessage = await this.queueWaiter.waitForCorrelation(
      options.queueName,
      this.context.correlationId,
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: 500
      }
    );

    await this.queueClient.acknowledge(options.queueName, queueMessage.id);

    return this.apiRepository.waitUntilStatus(command.id, command.status, {
      timeoutMs: options.timeoutMs,
      pollingIntervalMs: 400
    });
  }

  public async getFromDb(id: string): Promise<TemplateEntity | null> {
    return this.dbRepository.findById(id);
  }

  public async ensureDeleted(id: string): Promise<void> {
    await this.apiRepository.deleteIfExists(id);
    await this.dbRepository.deleteIfExists(id);
  }

  public async exists(id: string): Promise<boolean> {
    return this.apiRepository.existsById(id);
  }
}
