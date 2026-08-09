import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDeploymentPlan } from '../../lib/release/deployment-plan';

test('preview and local builds stay on the fast Next build path', () => {
  assert.deepEqual(createDeploymentPlan({ isVercelProduction: false }), [
    ['build-next'],
    ['verify-search-bundle'],
  ]);
});

test('production promotes assets, verifies alongside Next, then checks the bundle', () => {
  assert.deepEqual(createDeploymentPlan({ isVercelProduction: true }), [
    ['promote-staged-assets'],
    ['verify-release', 'build-next'],
    ['verify-search-bundle'],
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
  assert.match(source, /--defer-typecheck-to-next/);
  assert.match(source, /await Promise\.all\(\s*phase\.map/);
});

test('production delegates TypeScript only when Next runs in the same phase', async () => {
  const [buildSource, releaseSource] = await Promise.all([
    readFile('scripts/vercel-build.ts', 'utf8'),
    readFile('scripts/verify-release.ts', 'utf8'),
  ]);

  assert.match(buildSource, /--defer-typecheck-to-next/);
  assert.match(
    releaseSource,
    /process\.argv\.includes\(["']--defer-typecheck-to-next["']\)/,
  );
  assert.match(releaseSource, /process\.env\.VERCEL === ["']1["']/);
  assert.match(
    releaseSource,
    /process\.env\.VERCEL_ENV === ["']production["']/,
  );
  assert.match(releaseSource, /deferTypecheck && !isVercelProduction/);
  assert.match(releaseSource, /script === ["']typecheck["']/);
  assert.match(
    releaseSource,
    /Typecheck is delegated to the concurrent Next build/,
  );
});

test('staged asset checks use bounded concurrency', async () => {
  const source = await readFile('scripts/promote-staged-product-assets.ts', 'utf8');

  assert.match(source, /const promotionConcurrency = 6/);
  assert.match(source, /offset \+= promotionConcurrency/);
  assert.match(source, /\.slice\(offset, offset \+ promotionConcurrency\)/);
  assert.match(source, /await Promise\.all/);
});

test('the explicit operator reconciliation is ordered and external discovery is opt-in', async () => {
  const source = await readFile('scripts/reconcile-production-database.ts', 'utf8');
  assert.match(source, /requireAdminDatabaseUrl\(\)/);
  assert.match(source, /'db:migrate',[\s\S]*'db:seed',[\s\S]*'db:seed:external'[\s\S]*'assets:product:seed',[\s\S]*'assets:editorial:seed'/);
  assert.match(source, /--include-external-discovery/);
  assert.match(source, /options\.includes\(INCLUDE_EXTERNAL_DISCOVERY\)/);
});
