import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rootPackagePath = path.join(rootDir, 'package.json');
const rootReadmePath = path.join(rootDir, 'README.md');
const packageRoot = path.join(rootDir, 'packages');

const packageReadmeSections = [
  '## Purpose',
  '## Scope',
  '## Non-goals',
  '## Public API',
  '## Basic usage',
  '## Integration',
  '## Configuration',
  '## Error handling',
  '## Testing',
  '## Limitations',
  '## Extension points'
];

const rootReadmeSections = [
  '## Overview',
  '## Current status',
  '## What problems this project solves',
  '## What is included',
  '## Architecture map',
  '## Required tools',
  '## Installation',
  '## Environment variables',
  '## Run checks',
  '## Playwright e2e',
  '## Demo web app',
  '## Showcase scenarios',
  '## Module documentation',
  '## CI/CD',
  '## Artifacts and diagnostics',
  '## Limitations',
  '## Known risks',
  '## Next steps'
];

const bannedDocsTerms = [
  new RegExp('production' + '-grade', 'i'),
  new RegExp(`\\b${'puppe' + 'teer'}\\b`, 'i')
];
const ignoredDirs = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
]);

const readText = (filePath) => readFileSync(filePath, 'utf8');

const listMarkdownFiles = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (ignoredDirs.has(entry.name)) {
      return [];
    }

    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }

    return entry.name.toLowerCase().endsWith('.md') ? [entryPath] : [];
  });
};

const parseScripts = () => {
  const rootPackage = JSON.parse(readText(rootPackagePath));
  return new Set(Object.keys(rootPackage.scripts ?? {}));
};

const packageDirs = () =>
  readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const exportedSymbolsFor = (packageName) => {
  const indexPath = path.join(packageRoot, packageName, 'src', 'index.ts');
  if (!existsSync(indexPath)) {
    return new Set();
  }

  const source = readText(indexPath);
  const symbols = new Set();
  const directExportPattern =
    /export\s+(?:abstract\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  const groupedExportPattern = /export\s*\{([^}]+)\}/g;

  for (const match of source.matchAll(directExportPattern)) {
    const symbol = match[1];
    if (symbol) {
      symbols.add(symbol);
    }
  }

  for (const match of source.matchAll(groupedExportPattern)) {
    const exportList = match[1];
    if (!exportList) {
      continue;
    }

    const names = exportList.split(',');
    for (const rawName of names) {
      const [exportName] = rawName
        .trim()
        .split(/\s+as\s+/i)
        .reverse();
      const normalized = exportName?.trim();
      if (normalized) {
        symbols.add(normalized);
      }
    }
  }

  return symbols;
};

const extractNpmRunCommands = (content) => {
  const commands = new Set();
  const pattern = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g;
  for (const match of content.matchAll(pattern)) {
    const command = match[1];
    if (command) {
      commands.add(command);
    }
  }
  return [...commands].sort();
};

const extractAutomationPlatformImports = (content) => {
  const imports = [];
  const importPattern =
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@automation-platform\/([^'"]+)['"]/g;

  for (const match of content.matchAll(importPattern)) {
    const importList = match[1];
    const moduleName = match[2];
    if (!importList || !moduleName) {
      continue;
    }

    const symbols = importList
      .split(',')
      .map((symbol) =>
        symbol
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/i)[0]
          ?.trim()
      )
      .filter(Boolean);

    imports.push({ moduleName, symbols });
  }

  return imports;
};

const publicApiSymbols = (content) => {
  const section = content.match(/## Public API\s+([\s\S]*?)(?=\n## |$)/);
  if (!section?.[1]) {
    return [];
  }

  const symbols = new Set();
  for (const match of section[1].matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
    if (match[1]) {
      symbols.add(match[1]);
    }
  }

  return [...symbols].sort();
};

const issues = [];
const rootScripts = parseScripts();
const modules = packageDirs();
const moduleSet = new Set(modules);

if (!existsSync(rootReadmePath)) {
  issues.push('Root README.md is missing.');
} else {
  const rootReadme = readText(rootReadmePath);
  for (const section of rootReadmeSections) {
    if (!rootReadme.includes(section)) {
      issues.push(`Root README.md is missing section: ${section}`);
    }
  }

  for (const moduleName of modules) {
    const link = `packages/${moduleName}/README.md`;
    if (!rootReadme.includes(link)) {
      issues.push(`Root README.md does not link module README: ${link}`);
    }
  }
}

for (const moduleName of modules) {
  const readmePath = path.join(packageRoot, moduleName, 'README.md');
  if (!existsSync(readmePath)) {
    issues.push(`Missing package README: packages/${moduleName}/README.md`);
    continue;
  }

  const readme = readText(readmePath);
  const exports = exportedSymbolsFor(moduleName);
  for (const section of packageReadmeSections) {
    if (!readme.includes(section)) {
      issues.push(`packages/${moduleName}/README.md is missing section: ${section}`);
    }
  }

  for (const symbol of publicApiSymbols(readme)) {
    if (!exports.has(symbol)) {
      issues.push(
        `packages/${moduleName}/README.md lists non-exported Public API symbol: ${symbol}`
      );
    }
  }

  for (const { moduleName: importedModule, symbols } of extractAutomationPlatformImports(readme)) {
    if (!moduleSet.has(importedModule)) {
      issues.push(
        `packages/${moduleName}/README.md imports from missing package @automation-platform/${importedModule}`
      );
      continue;
    }

    const importedExports = exportedSymbolsFor(importedModule);
    for (const symbol of symbols) {
      if (!importedExports.has(symbol)) {
        issues.push(
          `packages/${moduleName}/README.md imports non-exported symbol ${symbol} from @automation-platform/${importedModule}`
        );
      }
    }
  }
}

for (const markdownFile of listMarkdownFiles(rootDir)) {
  const relPath = path.relative(rootDir, markdownFile).replaceAll(path.sep, '/');
  const content = readText(markdownFile);

  if (!content.includes('\n')) {
    issues.push(`${relPath} appears to be a single-line Markdown file.`);
  }

  const fenceCount = content.match(/```/g)?.length ?? 0;
  if (fenceCount % 2 !== 0) {
    issues.push(`${relPath} has an unclosed Markdown code fence.`);
  }

  for (const bannedTerm of bannedDocsTerms) {
    if (bannedTerm.test(content)) {
      issues.push(`${relPath} contains stale or over-strong wording: ${bannedTerm}`);
    }
  }

  for (const script of extractNpmRunCommands(content)) {
    if (!rootScripts.has(script)) {
      issues.push(`${relPath} references missing npm script: ${script}`);
    }
  }
}

if (issues.length > 0) {
  console.error('Documentation consistency check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log('Documentation consistency check passed.');
}
