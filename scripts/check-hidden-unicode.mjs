import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const ignoredDirs = new Set([
  '.git',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
]);

const explicitTargets = [
  '.github',
  '.gitlab-ci.yml',
  'README.md',
  'packages',
  'projects',
  'tests',
  'demo-web-app',
  'package.json',
  'playwright.config.ts',
  'scripts'
];

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml'
]);

const hiddenUnicodePattern = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

const isTextFile = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  return textExtensions.has(extension) || path.basename(filePath).startsWith('.');
};

const collectFiles = (targetPath) => {
  if (!existsSync(targetPath)) {
    return [];
  }

  const stats = statSync(targetPath);
  if (stats.isFile()) {
    return isTextFile(targetPath) ? [targetPath] : [];
  }

  const entries = readdirSync(targetPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        return [];
      }

      return collectFiles(entryPath);
    }

    return entry.isFile() && isTextFile(entryPath) ? [entryPath] : [];
  });
};

const positionFor = (content, index) => {
  const before = content.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
};

const formatCodePoint = (value) =>
  `U+${value.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

const files = [
  ...new Set(
    explicitTargets.flatMap((target) => {
      const absolute = path.resolve(rootDir, target);
      if (!existsSync(absolute)) {
        return [];
      }

      const statFiles = collectFiles(absolute);
      return statFiles.length > 0 ? statFiles : [absolute];
    })
  )
].filter(isTextFile);

const findings = [];

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');
  for (const match of content.matchAll(hiddenUnicodePattern)) {
    const index = match.index ?? 0;
    const position = positionFor(content, index);
    findings.push({
      filePath,
      line: position.line,
      column: position.column,
      codePoint: formatCodePoint(match[0])
    });
  }
}

if (findings.length > 0) {
  console.error('Hidden or bidirectional Unicode characters found:');
  for (const finding of findings) {
    const relativePath = path.relative(rootDir, finding.filePath).replaceAll(path.sep, '/');
    console.error(`- ${relativePath}:${finding.line}:${finding.column} ${finding.codePoint}`);
  }
  process.exitCode = 1;
} else {
  console.log('Hidden Unicode check passed.');
}
