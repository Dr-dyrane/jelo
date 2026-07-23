import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import { concernBySlug, concerns } from '@/data/knowledge';
import {
  isProductMatchConcern,
  productMatchesConcern,
  productReferencesConcern,
  rankProductsForConcerns,
} from './product-matching';

function product(slug: string) {
  const match = reviewedProductRecords.find(item => item.slug === slug);
  assert.ok(match, `Missing product fixture: ${slug}`);
  return match;
}

function concern(slug: string) {
  const match = concernBySlug(slug);
  assert.ok(match, `Missing concern fixture: ${slug}`);
  return match;
}

test('concern matching uses approved supportive uses, not catalogue concern prose', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  assert.equal(cleanser.concerns.includes('acne'), true);
  assert.equal(productMatchesConcern(cleanser, concern('acne-breakouts')), false);
  assert.equal(productMatchesConcern(cleanser, concern('oily-congested-skin')), true);

  const snail = product('cosrx-advanced-snail-96-mucin-power-essence');
  assert.equal(productMatchesConcern(snail, concern('sensitive-barrier')), false);
});

test('pharmacist-review products never enter direct concern matches', () => {
  const cleanser = product('cerave-blemish-control-cleanser');
  assert.equal(productMatchesConcern(cleanser, concern('acne-breakouts')), false);
  assert.equal(productReferencesConcern(cleanser, concern('acne-breakouts')), true);
});

test('condition patterns cannot match products even if an approved slug is reused', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  const approvedConcern = concern('oily-congested-skin');
  const adversarialPattern = {
    ...approvedConcern,
    kind: 'condition-pattern' as const,
    clinicalPatternIds: ['adversarial-test-pattern'],
    productTerms: [],
  };

  assert.equal(productMatchesConcern(cleanser, adversarialPattern), false);
  assert.equal(productReferencesConcern(cleanser, adversarialPattern), false);
});

test('every published condition pattern is product-ineligible', () => {
  const conditionPatterns = concerns.filter(item => item.kind === 'condition-pattern');

  for (const pattern of conditionPatterns) {
    for (const candidate of reviewedProductRecords) {
      assert.equal(productMatchesConcern(candidate, pattern), false, `${pattern.slug} matched ${candidate.slug}`);
    }
  }
});

test('condition patterns never enter mixed concern ranking', () => {
  const supportiveConcern = concern('oily-congested-skin');
  const conditionPattern = concern('leprosy-pattern');
  const cleanser = product('cerave-foaming-facial-cleanser');

  assert.equal(isProductMatchConcern(supportiveConcern), true);
  assert.equal(isProductMatchConcern(conditionPattern), false);
  assert.deepEqual(
    rankProductsForConcerns([cleanser], concerns, [supportiveConcern.slug, conditionPattern.slug]),
    [{ product: cleanser, index: 0, matchedConcernSlugs: [supportiveConcern.slug] }],
  );
  assert.deepEqual(rankProductsForConcerns([cleanser], concerns, [conditionPattern.slug]), []);
});
