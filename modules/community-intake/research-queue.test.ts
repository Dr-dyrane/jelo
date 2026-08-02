import assert from 'node:assert/strict';
import test from 'node:test';
import { communityResearchTasks } from '@/lib/community-intake/research-queue';
import { emptyContributionDraft } from '@/lib/community-intake/schema';

test('every submitted product becomes a community-first private research task', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    purposes: [{ id: 'purpose:acne', label: 'Acne', source: 'canonical' as const }],
    products: [{ id: 'custom:street-formula', label: 'Street Formula', source: 'custom' as const }],
    brands: [{ id: 'custom:street-labs', label: 'Street Labs', source: 'custom' as const }],
    retailers: [{ id: 'retailer:beauty-by-daz', label: 'Beauty by Daz', source: 'canonical' as const }],
    outcome: 'helped' as const,
    currentStep: 8,
  };

  const tasks = communityResearchTasks(draft);
  assert.deepEqual(tasks.map(task => [task.taskKind, task.entityLabel]), [
    ['product-identity', 'Street Formula'],
    ['retailer-refresh', 'Beauty by Daz'],
  ]);
  assert.equal(tasks.every(task => task.priorityLane === 'community-first'), true);
  assert.equal(tasks.every(task => task.publicationStatus === 'private-research-only'), true);
});

test('an already-canonical product requests price and retailer research instead of duplicate publication', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    products: [{
      id: 'product:cosrx-salicylic-acid-daily-gentle-cleanser',
      label: 'Salicylic Acid Daily Gentle Cleanser',
      source: 'canonical' as const,
    }],
    retailers: [{ id: 'custom:local-shop', label: 'Local Shop', source: 'custom' as const }],
  };

  const tasks = communityResearchTasks(draft);
  assert.equal(tasks[0].taskKind, 'product-retail-refresh');
  assert.equal(tasks[1].taskKind, 'retailer-identity');
});

test('duplicate values inside one submission cannot inflate research signals', () => {
  const product = { id: 'custom:one-product', label: 'One Product', source: 'custom' as const };
  const tasks = communityResearchTasks({
    ...emptyContributionDraft('routine'),
    products: [product, product],
  });
  assert.equal(tasks.length, 1);
});

test('custom punctuation and Unicode remain valid behind the exact custom namespace', () => {
  const tasks = communityResearchTasks({
    ...emptyContributionDraft('routine'),
    products: [{
      id: 'custom:toner: sensitive – 50 ml',
      label: 'Toner: Sensitive – 50 ml',
      source: 'custom' as const,
    }],
  });
  assert.equal(tasks[0].entityRef, 'custom:toner: sensitive – 50 ml');
  assert.equal(tasks[0].taskKind, 'product-identity');
});
