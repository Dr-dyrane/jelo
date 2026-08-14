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

test('production promotes assets, verifies, builds, then checks the bundle', () => {
  assert.deepEqual(createDeploymentPlan({ isVercelProduction: true }), [
    ['promote-staged-assets'],
    ['verify-release'],
    ['build-next'],
    ['verify-search-bundle'],
  ]);
});

test('Vercel builds cannot migrate, seed, or opt into external discovery', async () => {
  const source = await readFile('scripts/vercel-build.ts', 'utf8');
  for (const forbidden of [
    'db:migrate',
    'db:migrations:repair',
    'db:migrations:rehearse',
    'db:seed',
    'db:seed:external',
    'assets:product:seed',
    'assets:editorial:seed',
    'MIGRATION_DATABASE_URL',
    'MIGRATION_REHEARSAL_DATABASE_URL',
    'SKIP_DATABASE_MIGRATIONS',
    'SEED_EXTERNAL_CATALOGUE_ON_BUILD',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /assets:promote:staged/);
  assert.match(source, /JELO_VERCEL_RELEASE_TYPECHECK_PASSED: '1'/);
  assert.match(source, /await Promise\.all\(\s*phase\.map/);
});

test('Next skips its duplicate TypeScript pass only after production verification', async () => {
  const [buildSource, nextConfigSource] = await Promise.all([
    readFile('scripts/vercel-build.ts', 'utf8'),
    readFile('next.config.ts', 'utf8'),
  ]);

  assert.match(buildSource, /let releaseVerificationPassed = false/);
  assert.match(buildSource, /phase\.includes\('verify-release'\)[\s\S]*releaseVerificationPassed = true/);
  assert.match(buildSource, /step === 'build-next'[\s\S]*releaseVerificationPassed/);
  assert.match(nextConfigSource, /process\.env\.VERCEL === "1"/);
  assert.match(nextConfigSource, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(nextConfigSource, /JELO_VERCEL_RELEASE_TYPECHECK_PASSED === "1"/);
  assert.match(nextConfigSource, /ignoreBuildErrors: verifiedVercelProductionBuild/);
});

test('local mobile-device QA keeps CSP assets on the HTTP dev origin', async () => {
  const nextConfigSource = await readFile('next.config.ts', 'utf8');

  assert.match(
    nextConfigSource,
    /process\.env\.NODE_ENV === "development" \? \[\] : \["upgrade-insecure-requests"\]/,
  );
  assert.match(nextConfigSource, /\.\.\.transportUpgradeDirectives/);
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
