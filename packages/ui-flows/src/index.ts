import { ComponentFactory } from '@automation-platform/ui-components';
import type { UICore } from '@automation-platform/ui-core';
import type { PlatformLogger } from '@automation-platform/contracts';

export interface LoginFlowOptions {
  namespace?: string;
  usernameKey?: string;
  passwordKey?: string;
  submitKey?: string;
  successMarkerKey?: string;
}

export class AuthFlow {
  public constructor(
    private readonly ui: UICore,
    private readonly logger: PlatformLogger,
    private readonly namespace = 'auth'
  ) {}

  public async login(
    username: string,
    password: string,
    options: LoginFlowOptions = {}
  ): Promise<void> {
    const namespace = options.namespace ?? this.namespace;
    await this.ui.fill(options.usernameKey ?? 'username', username, namespace);
    await this.ui.fill(options.passwordKey ?? 'password', password, namespace);
    await this.ui.click(options.submitKey ?? 'submit', namespace);

    if (options.successMarkerKey) {
      await this.ui.waitVisible(options.successMarkerKey, namespace);
    }

    this.logger.info('AuthFlow login completed', {
      namespace
    });
  }

  public async logout(logoutButtonKey = 'logout', namespace = this.namespace): Promise<void> {
    await this.ui.click(logoutButtonKey, namespace);
    this.logger.info('AuthFlow logout completed', { namespace });
  }
}

export interface EntityCrudFlowOptions {
  namespace: string;
  openCreateButtonKey: string;
  submitCreateButtonKey: string;
  openEditButtonKey: (entityId: string) => string;
  submitEditButtonKey: string;
  openDeleteButtonKey: (entityId: string) => string;
  confirmDeleteButtonKey: string;
  statusKey: string;
}

export class EntityCrudFlow {
  public constructor(
    private readonly ui: UICore,
    private readonly logger: PlatformLogger,
    private readonly options: EntityCrudFlowOptions
  ) {}

  public async create(fieldValues: Record<string, string>): Promise<void> {
    await this.ui.click(this.options.openCreateButtonKey, this.options.namespace);
    for (const [key, value] of Object.entries(fieldValues)) {
      await this.ui.fill(key, value, this.options.namespace);
    }
    await this.ui.click(this.options.submitCreateButtonKey, this.options.namespace);
    await this.ui.waitVisible(this.options.statusKey, this.options.namespace);
    this.logger.info('EntityCrudFlow create completed', { namespace: this.options.namespace });
  }

  public async edit(entityId: string, fieldValues: Record<string, string>): Promise<void> {
    await this.ui.click(this.options.openEditButtonKey(entityId), this.options.namespace);
    for (const [key, value] of Object.entries(fieldValues)) {
      await this.ui.fill(key, value, this.options.namespace);
    }
    await this.ui.click(this.options.submitEditButtonKey, this.options.namespace);
    await this.ui.waitVisible(this.options.statusKey, this.options.namespace);
    this.logger.info('EntityCrudFlow edit completed', {
      namespace: this.options.namespace,
      entityId
    });
  }

  public async delete(entityId: string): Promise<void> {
    await this.ui.click(this.options.openDeleteButtonKey(entityId), this.options.namespace);
    await this.ui.click(this.options.confirmDeleteButtonKey, this.options.namespace);
    await this.ui.waitVisible(this.options.statusKey, this.options.namespace);
    this.logger.info('EntityCrudFlow delete completed', {
      namespace: this.options.namespace,
      entityId
    });
  }
}

export class SearchFilterSortFlow {
  private readonly components: ComponentFactory;

  public constructor(
    ui: UICore,
    logger: PlatformLogger,
    private readonly namespace = 'search'
  ) {
    this.components = new ComponentFactory({
      ui,
      logger,
      namespace
    });
  }

  public async search(query: string, submitKey = 'search.submit'): Promise<void> {
    await this.components.input('search.query').setValue(query);
    await this.components.button(submitKey).click();
  }

  public async applyFilter(filterKey: string, value: string): Promise<void> {
    await this.components.filterPanel('filters').setFilter(filterKey, value);
    await this.components.filterPanel('filters').apply();
  }

  public async sort(sortOption: string): Promise<void> {
    await this.components.select('search.sort').choose(sortOption);
  }
}

export class FileTransferFlow {
  private readonly components: ComponentFactory;

  public constructor(ui: UICore, logger: PlatformLogger, namespace = 'files') {
    this.components = new ComponentFactory({ ui, logger, namespace });
  }

  public async upload(filePath: string): Promise<void> {
    await this.components.fileUploader('uploader').upload(filePath);
    await this.components.toast('upload.toast').waitForMessage('uploaded');
  }

  public async download(downloadButtonKey = 'download.button'): Promise<void> {
    await this.components.button(downloadButtonKey).click();
  }
}

export class PermissionVisibilityFlow {
  public constructor(
    private readonly ui: UICore,
    private readonly logger: PlatformLogger
  ) {}

  public async expectVisible(key: string, namespace: string): Promise<void> {
    await this.ui.waitVisible(key, namespace);
    this.logger.info('Permission visibility verified', { key, namespace, expected: 'visible' });
  }

  public async expectHidden(key: string, namespace: string): Promise<void> {
    await this.ui.waitHidden(key, namespace);
    this.logger.info('Permission visibility verified', { key, namespace, expected: 'hidden' });
  }
}
