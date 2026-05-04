import type { PlatformLogger } from '@automation-platform/contracts';
import type { DatabaseClient } from '@automation-platform/contracts';
import { TemplateDbRepository } from '@automation-platform/repositories';

export class TemplateWebDbRepository extends TemplateDbRepository {
  public constructor(db: DatabaseClient, logger: PlatformLogger) {
    super(db, logger);
  }
}
