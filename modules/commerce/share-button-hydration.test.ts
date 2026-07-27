import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('share destinations stay identical during server render and hydration', async () => {
  const component = await readFile(
    path.join(process.cwd(), 'components/share/share-button.tsx'),
    'utf8',
  );

  assert.match(component, /new URL\(path, SITE\)\.toString\(\)/);
  assert.doesNotMatch(component, /window\.location\.origin/);
});
