#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { loadPlatformConfig, maskConfig } from '@automation-platform/config';
import { buildValidationResult, runGovernanceAudit } from '@automation-platform/governance';

const REQUIRED_ENV_VARS = [
  'AP_PROJECT_NAME',
  'AP_BASE_URL',
  'AP_LOG_LEVEL',
  'AP_BROWSER_HEADLESS'
] as const;

interface ScaffoldArgs {
  name: string;
  directory: string;
  force?: boolean;
}

const ensureTarget = async (filePath: string, force = false): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (!force) {
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      throw new Error(`File already exists: ${filePath}. Use --force to overwrite.`);
    }
  }
};

const writeTemplate = async (filePath: string, content: string, force = false): Promise<void> => {
  await ensureTarget(filePath, force);
  await fs.writeFile(filePath, content, 'utf8');
};

const asClassName = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');

const scaffoldAdapter = async (args: ScaffoldArgs): Promise<void> => {
  const className = `${asClassName(args.name)}ProjectAdapter`;
  const filePath = path.join(args.directory, `${args.name}.adapter.ts`);

  await writeTemplate(
    filePath,
    `import type { ProjectAdapter } from '@automation-platform/contracts';

export const ${className}: ProjectAdapter = {
  name: '${args.name}',
  version: '1.0.0',
  capabilities: {
    ui: true,
    api: true,
    db: false,
    queue: false,
    diagnostics: true,
    cleanup: true,
    plugins: true
  },
  featureFlags: {},
  routes: {},
  selectors: {
    resolve: () => undefined,
    list: () => []
  }
};
`,
    args.force
  );
  console.log(`Created adapter: ${filePath}`);
};

const scaffoldSelectorModule = async (args: ScaffoldArgs): Promise<void> => {
  const filePath = path.join(args.directory, `${args.name}.selectors.ts`);

  await writeTemplate(
    filePath,
    `import { SelectorBuilder } from '@automation-platform/selectors';

export const ${args.name}Selectors = [
  new SelectorBuilder('${args.name}', 'root')
    .withTestId('${args.name}-root')
    .withCss('[data-testid="${args.name}-root"]')
    .build()
];
`,
    args.force
  );

  console.log(`Created selectors module: ${filePath}`);
};

const scaffoldComponent = async (args: ScaffoldArgs): Promise<void> => {
  const className = `${asClassName(args.name)}Component`;
  const filePath = path.join(args.directory, `${args.name}.component.ts`);

  await writeTemplate(
    filePath,
    `import { ComponentFactory } from '@automation-platform/ui-components';
import { UICore } from '@automation-platform/ui-core';
import type { PlatformLogger } from '@automation-platform/contracts';

export class ${className} {
  private readonly components: ComponentFactory;

  public constructor(ui: UICore, logger: PlatformLogger, namespace = '${args.name}') {
    this.components = new ComponentFactory({ ui, logger, namespace });
  }

  public async open(): Promise<void> {
    await this.components.button('open').click();
  }
}
`,
    args.force
  );

  console.log(`Created component: ${filePath}`);
};

const scaffoldFlow = async (args: ScaffoldArgs): Promise<void> => {
  const className = `${asClassName(args.name)}Flow`;
  const filePath = path.join(args.directory, `${args.name}.flow.ts`);

  await writeTemplate(
    filePath,
    `import { UICore } from '@automation-platform/ui-core';
import type { PlatformLogger } from '@automation-platform/contracts';

export class ${className} {
  public constructor(
    private readonly ui: UICore,
    private readonly logger: PlatformLogger,
    private readonly namespace = '${args.name}'
  ) {}

  public async run(): Promise<void> {
    await this.ui.click('start', this.namespace);
    await this.ui.waitVisible('done', this.namespace);
    this.logger.info('${className} completed', { namespace: this.namespace });
  }
}
`,
    args.force
  );

  console.log(`Created flow: ${filePath}`);
};

const scaffoldRepository = async (args: ScaffoldArgs): Promise<void> => {
  const className = `${asClassName(args.name)}Repository`;
  const filePath = path.join(args.directory, `${args.name}.repository.ts`);

  await writeTemplate(
    filePath,
    `import type { HttpClient, PlatformLogger } from '@automation-platform/contracts';

export interface ${asClassName(args.name)}Entity {
  id: string;
  name: string;
  status: string;
}

export class ${className} {
  public constructor(private readonly client: HttpClient, private readonly logger: PlatformLogger) {}

  public async createMinimalValid(name: string): Promise<${asClassName(args.name)}Entity> {
    const response = await this.client.send<${asClassName(args.name)}Entity>({
      method: 'POST',
      path: '/${args.name}',
      body: { name }
    });
    return response.data;
  }
}
`,
    args.force
  );

  console.log(`Created repository: ${filePath}`);
};

const scaffoldGateway = async (args: ScaffoldArgs): Promise<void> => {
  const className = `${asClassName(args.name)}Gateway`;
  const filePath = path.join(args.directory, `${args.name}.gateway.ts`);

  await writeTemplate(
    filePath,
    `import type { ExecutionContext } from '@automation-platform/contracts';

export class ${className} {
  public constructor(private readonly context: ExecutionContext) {}

  public async executeScenario(): Promise<void> {
    this.context.logger.info('${className} scenario started', {
      executionId: this.context.executionId
    });
  }
}
`,
    args.force
  );

  console.log(`Created gateway: ${filePath}`);
};

const scaffoldTemplateTest = async (args: ScaffoldArgs): Promise<void> => {
  const filePath = path.join(args.directory, `${args.name}.test.ts`);

  await writeTemplate(
    filePath,
    `import { describe, it, expect } from 'vitest';

describe('${args.name}', () => {
  it('template test', () => {
    expect(true).toBe(true);
  });
});
`,
    args.force
  );

  console.log(`Created template test: ${filePath}`);
};

export const buildCli = (): Command => {
  const program = new Command();

  program.name('apf').description('Automation Platform Framework CLI').version('1.0.0');

  const scaffold = program.command('create').description('Scaffold platform entities');

  scaffold
    .command('adapter')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldAdapter);

  scaffold
    .command('selector-module')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldSelectorModule);

  scaffold
    .command('component')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldComponent);

  scaffold
    .command('flow')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldFlow);

  scaffold
    .command('repository')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldRepository);

  scaffold
    .command('gateway')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldGateway);

  scaffold
    .command('template-test')
    .requiredOption('--name <name>')
    .requiredOption('--directory <directory>')
    .option('--force', 'Overwrite existing files', false)
    .action(scaffoldTemplateTest);

  program.command('validate-config').action(() => {
    const config = loadPlatformConfig();
    console.log(JSON.stringify(maskConfig(config), null, 2));
  });

  program.command('inspect-env').action(() => {
    const envStatus = REQUIRED_ENV_VARS.map((name) => ({
      name,
      status: process.env[name] ? 'set' : 'missing'
    }));
    console.table(envStatus);
  });

  program
    .command('validate-governance')
    .option('--root <root>', 'Path to scan', process.cwd())
    .action(async ({ root }: { root: string }) => {
      const report = await runGovernanceAudit(root);
      const result = buildValidationResult(report.issues);

      if (result.warnings.length > 0) {
        console.warn('Governance warnings:');
        result.warnings.forEach((warning) => console.warn(`- ${warning}`));
      }

      if (!result.valid) {
        console.error('Governance errors:');
        result.errors.forEach((error) => console.error(`- ${error}`));
        process.exitCode = 1;
      } else {
        console.log('Governance validation passed');
      }
    });

  return program;
};

export const runCli = async (argv = process.argv): Promise<void> => {
  const program = buildCli();
  await program.parseAsync(argv);
};

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
