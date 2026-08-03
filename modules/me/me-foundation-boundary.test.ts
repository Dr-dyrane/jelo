import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';

const adr = readFileSync('docs/adr/0013-founder-led-jelocare-me.md', 'utf8');
const adapter = readFileSync('components/me/shell/me-workspace-dock.tsx', 'utf8');

test('the first Me route is session guarded without customer schema or seeded data', () => {
  assert.deepEqual(
    globSync('app/**/me/**').filter((path) => path.endsWith('.tsx')),
    ['app/(customer)/me/page.tsx'],
  );
  const route = readFileSync('app/(customer)/me/page.tsx', 'utf8');
  assert.match(route, /await requireCustomer\(\)/);
  assert.match(route, /readCustomerPortal\(customer\)/);
  assert.equal(globSync('db/migrations/**/*member*').length, 0);
  assert.equal(globSync('db/migrations/**/*shelf*').length, 0);
  assert.equal(globSync('db/migrations/**/*routine*').length, 0);
});

test('the customer adapter cannot import Operations semantics or colors', () => {
  assert.doesNotMatch(adapter, /components\/ops|--ops-|OpsChrome|moderation_operators/);
  assert.match(adr, /derive the authenticated owner\s+server-side/);
  assert.match(adr, /A client-provided owner ID is\s+data, never permission/);
  assert.match(adr, /customer identity never grants admin, retailer, or courier authority/);
});
