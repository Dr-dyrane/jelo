import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import {
  publishedProductCareManifest,
  reviewedProductCareManifest,
  type ReviewedProductCare,
} from '@/data/product-care-review';
import {
  assessOrdinaryCareIntent,
  hasDirectedDifferential,
  ordinaryCareIntentDefinitions,
} from './care-intent';
import { assessClinicalRoutine } from './engine';

test('explicit everyday requests resolve to canonical concern slugs', () => {
  const cases = [
    ['I need sunscreen for every day.', ['daily-sun-protection']],
    ['I want a deodorant for ordinary underarm odour.', ['sweat-body-odour']],
    ['I need a moisturiser for dry body skin.', ['dry-rough-body-skin']],
    ['I want shampoo and conditioner for dry frizzy hair.', ['dry-frizzy-hair']],
    ['I need a gentle moisturiser for dry face skin.', ['dry-dehydrated-skin']],
    ['I want a gentle routine for sensitive skin.', ['sensitive-barrier']],
    ['I need a cleanser for oily skin.', ['oily-congested-skin']],
  ] as const;

  for (const [query, expected] of cases) {
    const clinical = assessClinicalRoutine(query);
    const intent = assessOrdinaryCareIntent(query, clinical.differential);
    assert.deepEqual(intent?.concernSlugs, expected, query);
    assert.ok(intent?.routine.length, query);
  }
});

test('care intents are a closed set of canonical concern records', () => {
  const canonicalConcerns = new Map(concerns.map(concern => [concern.slug, concern]));
  const reviews = Object.values({
    ...reviewedProductCareManifest,
    ...publishedProductCareManifest,
  }) as ReviewedProductCare[];
  const supportiveUses = reviews
    .filter(review => review.careState === 'supportive_eligible')
    .flatMap(review => review.approvedUses);

  for (const definition of ordinaryCareIntentDefinitions) {
    const concern = canonicalConcerns.get(definition.concernSlug);
    assert.ok(concern, definition.concernSlug);
    assert.equal(concern.kind, 'concern', definition.concernSlug);
    assert.equal(definition.label, concern.name, definition.concernSlug);
    assert.ok(
      supportiveUses.some(use => use.concernSlugs?.includes(definition.concernSlug)),
      `${definition.concernSlug} has no supportive product-care use`,
    );
  }
});

test('a directed differential suppresses a nearby ordinary-care match', () => {
  const query = 'I need body lotion for rough tiny bumps on my upper arms.';
  const clinical = assessClinicalRoutine(query);

  assert.equal(clinical.differential.primary?.id, 'keratosis-pilaris-like');
  assert.equal(hasDirectedDifferential(clinical.differential), true);
  assert.equal(assessOrdinaryCareIntent(query, clinical.differential), undefined);
});

test('incidental low-confidence pattern scoring does not block ordinary care', () => {
  const query = 'I need sunscreen for every day.';
  const clinical = assessClinicalRoutine(query);

  assert.equal(clinical.differential.confidence, 'low');
  assert.equal(hasDirectedDifferential(clinical.differential), false);
  assert.deepEqual(
    assessOrdinaryCareIntent(query, clinical.differential)?.concernSlugs,
    ['daily-sun-protection'],
  );
});

test('descriptions without a supported ordinary-care intent remain outside the bridge', () => {
  for (const query of [
    'A rash appeared yesterday.',
    'My scalp is painful.',
    'This mole is changing.',
    'I have a fever.',
  ]) {
    assert.equal(assessOrdinaryCareIntent(query), undefined, query);
  }
});

test('product words cannot turn unresolved symptoms into ordinary shopping intent', () => {
  for (const query of [
    'I need body lotion for a rash.',
    'I want conditioner because my scalp is painful.',
    'I need body cream because my skin is itchy.',
    'I need deodorant because I suddenly smell different.',
    'I want sunscreen because my skin is burning.',
  ]) {
    assert.equal(assessOrdinaryCareIntent(query), undefined, query);
  }
});
