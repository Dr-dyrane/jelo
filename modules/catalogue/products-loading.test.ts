import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('catalogue route loading mirrors the active inventory grammar', async () => {
  const [loading, styles] = await Promise.all([
    readFile(path.join(root, 'app/(site)/products/loading.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/products/products-loading.module.css'), 'utf8'),
  ]);

  assert.match(loading, /'use client'/);
  assert.match(loading, /useSearchParams/);
  assert.match(loading, /hasActiveIntent/);
  assert.match(loading, /\{!hasActiveIntent \? <section className=\{styles\.shelf\}/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Array\.from\(\{ length: 8 \}/);
  assert.doesNotMatch(loading, /spinner/i);

  const compactRules = styles.slice(styles.indexOf('@media (max-width: 820px)'));
  assert.match(compactRules, /\.heroCopy\s*\{[\s\S]*order:\s*1/);
  assert.match(compactRules, /\.searchShell\s*\{[\s\S]*order:\s*2/);
  assert.match(compactRules, /\.heroVisual\s*\{[\s\S]*order:\s*3/);

  const phoneRules = styles.slice(styles.indexOf('@media (max-width: 640px)'));
  assert.match(phoneRules, /\.market\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(
    phoneRules,
    /\.grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*max\(9\.5rem,\s*46%\)\),\s*1fr\)\)/,
  );
  assert.match(phoneRules, /\.productVisual\s*\{[\s\S]*aspect-ratio:\s*\.82/);
  assert.match(styles, /prefers-reduced-motion:\s*no-preference/);
});

test('catalogue route error is quiet, recoverable, and catalogue-specific', async () => {
  const [boundary, styles] = await Promise.all([
    readFile(path.join(root, 'app/(site)/products/error.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/products/products-error.module.css'), 'utf8'),
  ]);

  assert.match(boundary, /The shelf paused\./);
  assert.match(boundary, /Try again/);
  assert.match(boundary, /Browse products/);
  assert.match(boundary, /href="\/products"/);
  assert.doesNotMatch(boundary, /digest|stack|database|server|backend/i);
  assert.match(styles, /\.state\s*\{[\s\S]*border-block:/);
  assert.match(styles, /\.actions button:focus-visible/);
});
