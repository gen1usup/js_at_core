import type { ExecutionContext, QueueClient } from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import { TemplateEntityGateway } from '@automation-platform/gateways';
import type { TemplateWebApiRepository } from './api-repository';
import type { TemplateWebDbRepository } from './db-repository';

export class TemplateWebGateway extends TemplateEntityGateway {
  public constructor(
    apiRepository: TemplateWebApiRepository,
    dbRepository: TemplateWebDbRepository,
    queueClient: QueueClient,
    context: ExecutionContext,
    logger: PlatformLogger
  ) {
    super(apiRepository, dbRepository, queueClient, context, logger);
  }
}
