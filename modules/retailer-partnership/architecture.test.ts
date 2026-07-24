import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('retailer partnerships stay private until a deliberate catalogue review', async () => {
  const root = process.cwd();
  const migration = await readFile(path.join(root, 'db/migrations/0016_retailer_partnership_intake.sql'), 'utf8');
  const repository = await readFile(path.join(root, 'lib/retailer-partnership/repository.ts'), 'utf8');
  const page = await readFile(path.join(root, 'app/(site)/retailers/page.tsx'), 'utf8');
  const experience = await readFile(path.join(root, 'components/retailers/retailer-partnership-experience.tsx'), 'utf8');
  const layout = await readFile(path.join(root, 'app/(site)/layout.tsx'), 'utf8');
  const magicRoute = await readFile(path.join(root, 'app/api/retailers/magic/route.ts'), 'utf8');
  const mailer = await readFile(path.join(root, 'lib/email/mailer.ts'), 'utf8');

  assert.match(migration, /retailer_partnership_applications/);
  assert.match(migration, /contact_consent_at/);
  assert.match(migration, /email_verified_at/);
  assert.match(migration, /magic_link_expires_at/);
  assert.doesNotMatch(repository, /insert into (products|retailers|offers|retail_offers)/i);
  assert.match(page, /id="list-your-store"/);
  assert.match(experience, /Send my private link/);
  assert.match(experience, /No website|required|website/i);
  assert.match(layout, /href="\/retailers#list-your-store"/);
  assert.match(magicRoute, /httpOnly|retailerPartnershipCookieName/);
  assert.match(magicRoute, /Referrer-Policy.+no-referrer/);
  assert.match(mailer, /smtp\.hostinger\.com/);
  assert.match(mailer, /EMAIL_API_TOKEN/);
  assert.match(mailer, /sendHostingerMailViaApi/);
});
