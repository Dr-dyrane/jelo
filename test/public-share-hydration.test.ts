import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('share links use one canonical origin during server and client rendering', async () => {
  const source = await readFile(
    path.join(process.cwd(), 'components/share/share-button.tsx'),
    'utf8',
  );

  assert.match(source, /const SITE = 'https:\/\/www\.jelocare\.com'/);
  assert.match(source, /const url = new URL\(path, SITE\)\.toString\(\)/);
  assert.doesNotMatch(source, /window\.location\.origin/);
});
