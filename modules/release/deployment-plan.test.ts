import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeploymentPlan, type DeploymentStep } from '../../lib/release/deployment-plan';

const externalMutations = new Set<DeploymentStep>([
  'promote-staged-assets',
  'migrate-database',
  'seed-catalogue',
  'seed-external-catalogue',
  'seed-product-assets',
  'seed-editorial-assets',
]);

test('preview and local builds stay on the fast Next build path', () => {
  assert.deepEqual(createDeploymentPlan({
    isVercelProduction: false,
    migrationsDisabled: false,
    seedExternalCatalogue: true,
  }), ['build-next']);
});

test('production verifies and builds before any external mutation', () => {
  const plan = createDeploymentPlan({
    isVercelProduction: true,
    migrationsDisabled: false,
    seedExternalCatalogue: true,
  });
  const firstMutation = plan.findIndex(step => externalMutations.has(step));

  assert.deepEqual(plan.slice(0, firstMutation), ['verify-release', 'build-next']);
  assert.deepEqual(plan.slice(firstMutation), [
    'promote-staged-assets',
    'migrate-database',
    'seed-catalogue',
    'seed-external-catalogue',
    'seed-product-assets',
    'seed-editorial-assets',
    'build-next',
  ]);
  assert.equal(plan.at(-1), 'build-next');
});

test('the emergency migration control cannot bypass production verification', () => {
  assert.deepEqual(createDeploymentPlan({
    isVercelProduction: true,
    migrationsDisabled: true,
    seedExternalCatalogue: true,
  }), ['verify-release', 'build-next']);
});

test('routine production releases sync reviewed products without reseeding external discovery', () => {
  assert.deepEqual(createDeploymentPlan({
    isVercelProduction: true,
    migrationsDisabled: false,
    seedExternalCatalogue: false,
  }), [
    'verify-release',
    'build-next',
    'promote-staged-assets',
    'migrate-database',
    'seed-catalogue',
    'seed-product-assets',
    'seed-editorial-assets',
    'build-next',
  ]);
});
