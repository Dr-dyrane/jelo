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

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Array\.from\(\{ length: 8 \}/);
  assert.doesNotMatch(loading, /spinner/i);

  const compactRules = styles.slice(styles.indexOf('@media (max-width: 640px)'));
  assert.match(compactRules, /\.grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/);
  assert.match(styles, /prefers-reduced-motion:\s*no-preference/);
});
