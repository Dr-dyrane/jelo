import assert from 'node:assert/strict';
import test from 'node:test';
import { communityKnowledgeEdges, unknownCommunityValues } from '@/lib/community-intake/moderation';
import { emptyContributionDraft } from '@/lib/community-intake/schema';

test('custom vocabulary enters moderation without changing canonical data', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    purposes: [{ id: 'custom:chicken-skin', label: '  Chicken   Skin ', source: 'custom' as const }],
    products: [{ id: 'product:test', label: 'Test lotion', source: 'canonical' as const }],
    brands: [{ id: 'brand:test', label: 'Test', source: 'canonical' as const }],
    retailers: [{ id: 'custom:my-shop', label: 'My Shop', source: 'custom' as const }],
    outcome: 'unsure' as const,
    currentStep: 8,
  };
  assert.deepEqual(unknownCommunityValues(draft), [
    { kind: 'purpose', fieldPath: 'purposes', rawValue: '  Chicken   Skin ', normalizedValue: 'chicken skin' },
    { kind: 'retailer', fieldPath: 'retailers', rawValue: 'My Shop', normalizedValue: 'my shop' },
  ]);
});

test('every submitted answer becomes a pending community-reported edge', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    purposes: [{ id: 'purpose:acne', label: 'Acne', source: 'canonical' as const }],
    products: [{ id: 'product:test', label: 'Test lotion', source: 'canonical' as const }],
    brands: [{ id: 'brand:test', label: 'Test', source: 'canonical' as const }],
    retailers: [{ id: 'retailer:test', label: 'Test shop', source: 'canonical' as const }],
    priceNgn: 17_500,
    outcome: 'helped' as const,
    currentStep: 8,
  };
  const edges = communityKnowledgeEdges(draft, 'contribution-id');
  assert.ok(edges.some(edge => edge.predicate === 'reported_for'));
  assert.ok(edges.some(edge => edge.predicate === 'reported_product'));
  assert.ok(edges.some(edge => edge.predicate === 'reported_retailer'));
  assert.ok(edges.some(edge => edge.predicate === 'reported_price' && edge.objectRef === '17500'));
  assert.ok(edges.some(edge => edge.predicate === 'reported_outcome'));
});
