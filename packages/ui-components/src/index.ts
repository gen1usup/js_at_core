import type { UIComponent, UIWaitOptions } from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import type { UICore } from '@automation-platform/ui-core';

abstract class BaseComponent implements UIComponent {
  public abstract readonly componentName: string;

  public constructor(
    protected readonly ui: UICore,
    protected readonly logger: PlatformLogger,
    protected readonly key: string,
    protected readonly namespace: string
  ) {}

  public async isVisible(options: UIWaitOptions = {}): Promise<boolean> {
    try {
      await this.ui.waitVisible(this.key, this.namespace, options);
      return true;
    } catch {
      return false;
    }
  }

  protected log(action: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(`${this.componentName}:${action}`, {
      component: this.componentName,
      key: this.key,
      namespace: this.namespace,
      ...metadata
    });
  }
}

export class ButtonComponent extends BaseComponent {
  public readonly componentName = 'ButtonComponent';

  public async click(): Promise<void> {
    this.log('click');
    await this.ui.click(this.key, this.namespace);
  }

  public async doubleClick(): Promise<void> {
    this.log('doubleClick');
    await this.ui.doubleClick(this.key, this.namespace);
  }

  public async hover(): Promise<void> {
    this.log('hover');
    await this.ui.hover(this.key, this.namespace);
  }
}

export class InputComponent extends BaseComponent {
  public readonly componentName: string = 'InputComponent';

  public async setValue(value: string): Promise<void> {
    this.log('setValue', { valueLength: value.length });
    await this.ui.fill(this.key, value, this.namespace);
  }

  public async clear(): Promise<void> {
    this.log('clear');
    await this.ui.clear(this.key, this.namespace);
  }

  public async value(): Promise<string> {
    return this.ui.value(this.key, this.namespace);
  }
}

export class TextareaComponent extends InputComponent {
  public readonly componentName: string = 'TextareaComponent';
}

export class CheckboxComponent extends BaseComponent {
  public readonly componentName = 'CheckboxComponent';

  public async check(): Promise<void> {
    this.log('check');
    await this.ui.check(this.key, this.namespace);
  }

  public async uncheck(): Promise<void> {
    this.log('uncheck');
    await this.ui.uncheck(this.key, this.namespace);
  }

  public async isChecked(): Promise<boolean> {
    const checked = await this.ui.attribute(this.key, 'checked', this.namespace);
    return checked !== null;
  }
}

export class RadioComponent extends BaseComponent {
  public readonly componentName = 'RadioComponent';

  public async select(): Promise<void> {
    this.log('select');
    await this.ui.click(this.key, this.namespace);
  }

  public async isSelected(): Promise<boolean> {
    const checked = await this.ui.attribute(this.key, 'checked', this.namespace);
    return checked !== null;
  }
}

export class SelectComponent extends BaseComponent {
  public readonly componentName = 'SelectComponent';

  public async choose(value: string | string[]): Promise<void> {
    this.log('choose');
    await this.ui.select(this.key, value, this.namespace);
  }

  public async selectedValue(): Promise<string> {
    return this.ui.value(this.key, this.namespace);
  }
}

export class TableComponent extends BaseComponent {
  public readonly componentName = 'TableComponent';

  public async cellText(row: number, column: number): Promise<string> {
    const key = `${this.key}.row-${row}.col-${column}`;
    this.log('cellText', { row, column });
    return this.ui.text(key, this.namespace);
  }

  public async rowVisible(row: number): Promise<boolean> {
    const key = `${this.key}.row-${row}`;
    try {
      await this.ui.waitExists(key, this.namespace, { timeoutMs: 3_000 });
      return true;
    } catch {
      return false;
    }
  }
}

export class GridComponent extends BaseComponent {
  public readonly componentName = 'GridComponent';

  public async tileText(index: number): Promise<string> {
    return this.ui.text(`${this.key}.tile-${index}`, this.namespace);
  }
}

export class ModalComponent extends BaseComponent {
  public readonly componentName = 'ModalComponent';

  public async open(triggerKey: string): Promise<void> {
    await this.ui.click(triggerKey, this.namespace);
    await this.ui.waitVisible(this.key, this.namespace);
  }

  public async close(closeButtonKey: string): Promise<void> {
    await this.ui.click(closeButtonKey, this.namespace);
    await this.ui.waitHidden(this.key, this.namespace);
  }
}

export class DrawerComponent extends BaseComponent {
  public readonly componentName = 'DrawerComponent';

  public async open(openButtonKey: string): Promise<void> {
    await this.ui.click(openButtonKey, this.namespace);
    await this.ui.waitVisible(this.key, this.namespace);
  }

  public async close(closeButtonKey: string): Promise<void> {
    await this.ui.click(closeButtonKey, this.namespace);
    await this.ui.waitHidden(this.key, this.namespace);
  }
}

export class ToastComponent extends BaseComponent {
  public readonly componentName = 'ToastComponent';

  public async message(): Promise<string> {
    return this.ui.text(this.key, this.namespace);
  }

  public async waitForMessage(text: string): Promise<void> {
    await this.ui.waitText(this.key, text, this.namespace);
  }
}

export class TabsComponent extends BaseComponent {
  public readonly componentName = 'TabsComponent';

  public async open(tabKey: string): Promise<void> {
    await this.ui.click(`${this.key}.${tabKey}`, this.namespace);
  }
}

export class PaginationComponent extends BaseComponent {
  public readonly componentName = 'PaginationComponent';

  public async next(): Promise<void> {
    await this.ui.click(`${this.key}.next`, this.namespace);
  }

  public async previous(): Promise<void> {
    await this.ui.click(`${this.key}.previous`, this.namespace);
  }

  public async goTo(pageNumber: number): Promise<void> {
    await this.ui.click(`${this.key}.page-${pageNumber}`, this.namespace);
  }
}

export class HeaderComponent extends BaseComponent {
  public readonly componentName = 'HeaderComponent';

  public async title(): Promise<string> {
    return this.ui.text(`${this.key}.title`, this.namespace);
  }
}

export class SidebarComponent extends BaseComponent {
  public readonly componentName = 'SidebarComponent';

  public async openItem(itemKey: string): Promise<void> {
    await this.ui.click(`${this.key}.${itemKey}`, this.namespace);
  }
}

export class FileUploaderComponent extends BaseComponent {
  public readonly componentName = 'FileUploaderComponent';

  public async upload(filePath: string): Promise<void> {
    await this.ui.upload(this.key, filePath, this.namespace);
  }
}

export class FilterPanelComponent extends BaseComponent {
  public readonly componentName = 'FilterPanelComponent';

  public async setFilter(filterKey: string, value: string): Promise<void> {
    await this.ui.fill(`${this.key}.${filterKey}`, value, this.namespace);
  }

  public async apply(applyButtonKey = `${this.key}.apply`): Promise<void> {
    await this.ui.click(applyButtonKey, this.namespace);
  }

  public async reset(resetButtonKey = `${this.key}.reset`): Promise<void> {
    await this.ui.click(resetButtonKey, this.namespace);
  }
}

export class DatePickerComponent extends BaseComponent {
  public readonly componentName = 'DatePickerComponent';

  public async setDate(value: string): Promise<void> {
    await this.ui.fill(this.key, value, this.namespace);
  }
}

export class LoaderComponent extends BaseComponent {
  public readonly componentName = 'LoaderComponent';

  public async waitUntilHidden(timeoutMs = 10_000): Promise<void> {
    await this.ui.waitHidden(this.key, this.namespace, { timeoutMs });
  }
}

export interface ComponentFactoryOptions {
  ui: UICore;
  logger: PlatformLogger;
  namespace: string;
}

export class ComponentFactory {
  public constructor(private readonly options: ComponentFactoryOptions) {}

  public button(key: string): ButtonComponent {
    return new ButtonComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public input(key: string): InputComponent {
    return new InputComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public textarea(key: string): TextareaComponent {
    return new TextareaComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public checkbox(key: string): CheckboxComponent {
    return new CheckboxComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public radio(key: string): RadioComponent {
    return new RadioComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public select(key: string): SelectComponent {
    return new SelectComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public table(key: string): TableComponent {
    return new TableComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public grid(key: string): GridComponent {
    return new GridComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public modal(key: string): ModalComponent {
    return new ModalComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public drawer(key: string): DrawerComponent {
    return new DrawerComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public toast(key: string): ToastComponent {
    return new ToastComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public tabs(key: string): TabsComponent {
    return new TabsComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public pagination(key: string): PaginationComponent {
    return new PaginationComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public header(key: string): HeaderComponent {
    return new HeaderComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public sidebar(key: string): SidebarComponent {
    return new SidebarComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public fileUploader(key: string): FileUploaderComponent {
    return new FileUploaderComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public filterPanel(key: string): FilterPanelComponent {
    return new FilterPanelComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public datePicker(key: string): DatePickerComponent {
    return new DatePickerComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }

  public loader(key: string): LoaderComponent {
    return new LoaderComponent(this.options.ui, this.options.logger, key, this.options.namespace);
  }
}


