import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyContributionDraft, finalContributionSchema } from '@/lib/community-intake/schema';

const canonical = (id: string, label: string) => ({ id, label, source: 'canonical' as const });

test('a complete product contribution is accepted', () => {
  const draft = {
    ...emptyContributionDraft('product'),
    purposes: [canonical('purpose:acne', 'Acne')],
    products: [canonical('product:cleanser', 'Cleanser')],
    brands: [canonical('brand:example', 'Example')],
    retailers: [canonical('retailer:teeka4', 'Teeka4')],
    priceNgn: 17_500,
    purchaseDate: '2026-07-01',
    outcome: 'helped' as const,
    currentStep: 8,
  };
  assert.equal(finalContributionSchema.safeParse(draft).success, true);
});

test('final intake rejects missing store evidence and future purchase dates', () => {
  const missingStore = {
    ...emptyContributionDraft('product'),
    purposes: [canonical('purpose:acne', 'Acne')],
    products: [canonical('product:cleanser', 'Cleanser')],
    brands: [canonical('brand:example', 'Example')],
    outcome: 'helped' as const,
    currentStep: 8,
  };
  assert.equal(finalContributionSchema.safeParse(missingStore).success, false);
  assert.equal(finalContributionSchema.safeParse({ ...missingStore, retailers: [canonical('retailer:x', 'X')], purchaseDate: '2099-01-01' }).success, false);
});

test('routine and store branches require only their relevant facts', () => {
  const routine = {
    ...emptyContributionDraft('routine'),
    purposes: [canonical('purpose:barrier', 'Barrier support')],
    products: [canonical('product:cream', 'Cream')],
    outcome: 'love-it' as const,
    currentStep: 5,
  };
  const store = {
    ...emptyContributionDraft('store'),
    purposes: [canonical('purpose:body', 'Body')],
    retailers: [canonical('retailer:local', 'Local store')],
    currentStep: 4,
  };
  assert.equal(finalContributionSchema.safeParse(routine).success, true);
  assert.equal(finalContributionSchema.safeParse(store).success, true);
});
