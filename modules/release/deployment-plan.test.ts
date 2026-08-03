import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDeploymentPlan } from '../../lib/release/deployment-plan';

test('preview and local builds stay on the fast Next build path', () => {
  assert.deepEqual(createDeploymentPlan({ isVercelProduction: false }), ['build-next']);
});

test('production verifies and builds before the only external build mutation', () => {
  assert.deepEqual(createDeploymentPlan({ isVercelProduction: true }), [
    'verify-release',
    'build-next',
    'promote-staged-assets',
  ]);
});

test('Vercel builds cannot migrate, seed, or opt into external discovery', async () => {
  const source = await readFile('scripts/vercel-build.ts', 'utf8');
  for (const forbidden of [
    'db:migrate',
    'db:seed',
    'db:seed:external',
    'assets:product:seed',
    'assets:editorial:seed',
    'MIGRATION_DATABASE_URL',
    'SKIP_DATABASE_MIGRATIONS',
    'SEED_EXTERNAL_CATALOGUE_ON_BUILD',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /assets:promote:staged/);
});

test('the explicit operator reconciliation is ordered and external discovery is opt-in', async () => {
  const source = await readFile('scripts/reconcile-production-database.ts', 'utf8');
  assert.match(source, /requireAdminDatabaseUrl\(\)/);
  assert.match(source, /'db:migrate',[\s\S]*'db:seed',[\s\S]*'db:seed:external'[\s\S]*'assets:product:seed',[\s\S]*'assets:editorial:seed'/);
  assert.match(source, /--include-external-discovery/);
  assert.match(source, /options\.includes\(INCLUDE_EXTERNAL_DISCOVERY\)/);
});
