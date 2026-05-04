import type { PlatformLogger } from '@automation-platform/contracts';
import type { HttpClient } from '@automation-platform/contracts';
import { TemplateApiRepository } from '@automation-platform/repositories';

export class TemplateWebApiRepository extends TemplateApiRepository {
  public constructor(client: HttpClient, logger: PlatformLogger) {
    super(client, logger);
  }
}
