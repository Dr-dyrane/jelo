import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const repositoryRoot = process.cwd();
const documentationRoot = resolve(repositoryRoot, 'docs');
const handbook = resolve(documentationRoot, 'README.md');
const entrypoints = [
  resolve(repositoryRoot, 'README.md'),
  resolve(repositoryRoot, 'CODEX_HANDOFF.md'),
  handbook,
];

function markdownFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap(entry => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory()
        ? markdownFiles(path)
        : extname(path).toLowerCase() === '.md'
          ? [path]
          : [];
    });
}

function linkedMarkdownFiles(file: string) {
  const source = readFileSync(file, 'utf8');
  const links = source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  const targets = new Set<string>();

  for (const match of links) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget || rawTarget.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(rawTarget)) continue;

    const withoutAnchor = rawTarget.split('#', 1)[0];
    const decoded = decodeURIComponent(withoutAnchor.replace(/^<|>$/g, ''));
    const target = resolve(dirname(file), decoded);
    if (extname(target).toLowerCase() === '.md') targets.add(target);
  }

  return [...targets];
}

const files = [...new Set([...entrypoints, ...markdownFiles(documentationRoot)])];
const failures: string[] = [];

for (const file of files) {
  const label = relative(repositoryRoot, file);
  const source = readFileSync(file, 'utf8');

  if (source.includes('\r')) failures.push(`${label}: use LF line endings`);
  if (!source.endsWith('\n')) failures.push(`${label}: add a final newline`);
  if (source.endsWith('\n\n')) failures.push(`${label}: remove blank lines at EOF`);

  source.split('\n').forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${label}:${index + 1}: remove trailing whitespace`);
  });

  for (const target of linkedMarkdownFiles(file)) {
    if (!existsSync(target)) {
      failures.push(`${label}: broken link to ${relative(repositoryRoot, target)}`);
    }
  }
}

const reachable = new Set<string>();
const pending = [handbook];
while (pending.length > 0) {
  const file = pending.pop();
  if (!file || reachable.has(file) || !existsSync(file)) continue;
  reachable.add(file);
  for (const target of linkedMarkdownFiles(file)) {
    if (target.startsWith(`${documentationRoot}/`)) pending.push(target);
  }
}

for (const file of markdownFiles(documentationRoot)) {
  if (!reachable.has(file)) {
    failures.push(`${relative(repositoryRoot, file)}: not reachable from docs/README.md`);
  }
}

if (failures.length > 0) {
  console.error(`Documentation check failed (${failures.length}).`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed (${files.length} files).`);
}
