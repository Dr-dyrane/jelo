import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('zero-signal research work is absent from the queue, deep links, and sidebar count', async () => {
  const [tasks, queues, productResolution, retailerResolution] = await Promise.all([
    source('lib/moderation/research-tasks.ts'),
    source('lib/moderation/queues.ts'),
    source('lib/community-intake/research-resolution.ts'),
    source('lib/community-intake/retailer-research-resolution.ts'),
  ]);

  assert.equal((tasks.match(/task\.signal_count > 0/g) ?? []).length, 2);
  assert.match(queues, /from community_research_tasks[\s\S]*?signal_count > 0/);
  assert.match(productResolution, /task\.signal_count <= 0[\s\S]*?cannot be resolved/);
  assert.match(retailerResolution, /task\.signal_count <= 0[\s\S]*?cannot be resolved/);
});
