import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('community intake stays separated from canonical data and public media', async () => {
  const root = process.cwd();
  const migration = await readFile(path.join(root, 'db/migrations/0015_community_knowledge_intake.sql'), 'utf8');
  const repository = await readFile(path.join(root, 'lib/community-intake/repository.ts'), 'utf8');
  const security = await readFile(path.join(root, 'lib/community-intake/security.ts'), 'utf8');
  const page = await readFile(path.join(root, 'app/contribute/page.tsx'), 'utf8');
  const selector = await readFile(path.join(root, 'components/ui/adaptive-selector.tsx'), 'utf8');
  const adr = await readFile(path.join(root, 'docs/adr/0002-anonymous-community-knowledge-intake.md'), 'utf8');

  assert.match(migration, /community_intake_drafts/);
  assert.match(migration, /community_moderation_values/);
  assert.match(migration, /community_knowledge_edges/);
  assert.match(migration, /confidence_state text not null default 'community_reported'/);
  assert.doesNotMatch(repository, /insert into (products|brands|retailers|offers|concerns|ingredients)/i);
  assert.doesNotMatch(repository, /@vercel\/blob|put\(/);
  assert.match(security, /httpOnly|contributionCookieName/);
  assert.match(security, /createHmac/);
  assert.match(page, /Tell us about one product/);
  assert.match(page, /No account/);
  assert.match(selector, /role="combobox"/);
  assert.match(selector, /role="listbox"/);
  assert.match(selector, /aria-activedescendant/);
  assert.match(adr, /does not accept photos or receipts/);
  assert.match(adr, /not a mandate to replace every input/);
  assert.match(adr, /does not teach canonical search/);
});
