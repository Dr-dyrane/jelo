import assert from 'node:assert/strict';
import test from 'node:test';
import { expandedProducts } from '@/data/expanded-products';
import { concernBySlug } from '@/data/knowledge';
import { publishedIntakeProducts } from '@/data/published-intake-products';
import {
  publishedProductCareManifest,
  reviewedProductCareManifest,
} from '@/data/product-care-review';
import { products as coreProducts, type Product } from '@/data/products';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';
import { evaluateProductClinically } from './clinical-product-filter';

const catalogue = [...coreProducts, ...expandedProducts];

function product(slug: string) {
  const match = catalogue.find(item => item.slug === slug);
  assert.ok(match, `Missing product fixture: ${slug}`);
  return match;
}

test('the care manifest covers all 24 products with the audited state counts', () => {
  const productSlugs = catalogue.map(item => item.slug).sort();
  const reviewSlugs = Object.keys(reviewedProductCareManifest).sort();
  const states = Object.values(reviewedProductCareManifest).map(review => review.careState);

  assert.equal(productSlugs.length, 24);
  assert.deepEqual(reviewSlugs, productSlugs);
  assert.equal(states.filter(state => state === 'supportive_eligible').length, 3);
  assert.equal(states.filter(state => state === 'pharmacist_review').length, 5);
  assert.equal(states.filter(state => state === 'insufficient_data').length, 16);
});

test('every dossier-released product has an explicit post-publication care decision', () => {
  const productSlugs = publishedIntakeProducts.map(item => item.slug).sort();
  const reviewSlugs = Object.keys(publishedProductCareManifest).sort();
  const states = Object.values(publishedProductCareManifest).map(review => review.careState);

  assert.equal(productSlugs.length, 47);
  assert.deepEqual(reviewSlugs, productSlugs);
  assert.equal(states.filter(state => state === 'supportive_eligible').length, 18);
  assert.equal(states.filter(state => state === 'pharmacist_review').length, 16);
  assert.equal(states.filter(state => state === 'insufficient_data').length, 13);
});

test('every approved-use concern slug resolves only to an ordinary concern', () => {
  const manifests = [reviewedProductCareManifest, publishedProductCareManifest];

  for (const manifest of manifests) {
    for (const review of Object.values(manifest)) {
      for (const use of review.approvedUses) {
        for (const slug of use.concernSlugs ?? []) {
          const concern = concernBySlug(slug);
          assert.ok(concern, `${review.productSlug}:${use.id} references missing concern ${slug}`);
          assert.equal(
            concern.kind,
            'concern',
            `${review.productSlug}:${use.id} must not reference condition pattern ${slug}`,
          );
        }
      }
    }
  }
});

test('unsupported text-derived active never qualifies or enters ingredient evidence', () => {
  const namedForAnActive = product('cosrx-salicylic-acid-daily-gentle-cleanser');
  const clinical = assessClinicalRoutine('My face is oily with blackheads.', { concerns: ['oiliness', 'blackheads'] });
  const decision = evaluateProductClinically(namedForAnActive, clinical);

  assert.equal(decision.careState, 'insufficient_data');
  assert.equal(decision.ingredientIds.includes('salicylic-acid'), false);
  assert.equal(decision.eligible, false);
  assert.match(decision.exclusions.join(' '), /insufficient/i);
});

test('supportive CeraVe cleanser qualifies only through its canonical oily-skin concern', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  const oily = evaluateProductClinically(
    cleanser,
    assessClinicalRoutine('My face gets oily through the day.', { concerns: ['oiliness'] }),
    [],
    { concernSlugs: ['oily-congested-skin'] },
  );
  const acne = evaluateProductClinically(
    cleanser,
    assessClinicalRoutine('I have inflamed acne.', { concerns: ['acne'] }),
    [],
    { concernSlugs: ['acne-breakouts'] },
  );
  const barrier = evaluateProductClinically(
    cleanser,
    assessClinicalRoutine('My skin barrier feels damaged.', { concerns: ['barrier'] }),
    [],
    { concernSlugs: ['sensitive-barrier'] },
  );

  assert.equal(oily.eligible, true);
  assert.deepEqual(oily.approvedUseIds, ['normal-oily-cleansing']);
  assert.equal(acne.eligible, false);
  assert.equal(barrier.eligible, false);
});

test('supportive COSRX snail essence qualifies only for hydration and conditioning', () => {
  const essence = product('cosrx-advanced-snail-96-mucin-power-essence');
  const hydration = evaluateProductClinically(
    essence,
    assessClinicalRoutine('My face feels dry and tight.', { concerns: ['dryness'] }),
    [],
    { concernSlugs: ['dry-dehydrated-skin'] },
  );
  const darkSpots = evaluateProductClinically(
    essence,
    assessClinicalRoutine('I have dark marks after spots.', { concerns: ['hyperpigmentation', 'dark spots'] }),
    [],
    { concernSlugs: ['dark-spots'] },
  );
  const barrierTreatment = evaluateProductClinically(
    essence,
    assessClinicalRoutine('I damaged my skin barrier.', { concerns: ['barrier'] }),
    [],
    { concernSlugs: ['sensitive-barrier'] },
  );

  assert.equal(hydration.eligible, true);
  assert.deepEqual(hydration.approvedUseIds, ['hydration-conditioning']);
  assert.equal(darkSpots.eligible, false);
  assert.equal(barrierTreatment.eligible, false);
});

test('daily sun protection qualifies only the explicitly reviewed Eucerin sunscreen', () => {
  const clinical = assessClinicalRoutine(
    'I want reliable daily sun protection for my face.',
    { concerns: ['sun protection'] },
  );
  const eligible = [...catalogue, ...publishedIntakeProducts]
    .map(candidate => evaluateProductClinically(
      candidate,
      clinical,
      [],
      { concernSlugs: ['daily-sun-protection'] },
    ))
    .filter(decision => decision.eligible);

  assert.deepEqual(eligible.map(decision => decision.slug), ['eucerin-oil-control-sun-gel-cream-spf50-50ml']);
  assert.deepEqual(eligible[0]?.approvedUseIds, ['oily-skin-sun-protection']);
});

test('canonical concern slugs reach reviewed uses without becoming legacy concern ids', () => {
  const sunscreen = publishedIntakeProducts.find(
    item => item.slug === 'eucerin-oil-control-sun-gel-cream-spf50-50ml',
  );
  assert.ok(sunscreen);
  const clinical = assessClinicalRoutine('I want an everyday sunscreen.', { concerns: [] });
  const withoutSlug = evaluateProductClinically(sunscreen, clinical);
  const withSlug = evaluateProductClinically(
    sunscreen,
    clinical,
    [],
    { concernSlugs: ['daily-sun-protection'] },
  );

  assert.equal(withoutSlug.eligible, false);
  assert.equal(withSlug.eligible, true);
  assert.deepEqual(withSlug.approvedUseIds, ['oily-skin-sun-protection']);
});

test('a canonical concern cannot authorize a product in the wrong body area', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  const wrongAreaProduct = {
    ...cleanser,
    category: 'Hair' as const,
  };
  const decision = evaluateProductClinically(
    wrongAreaProduct,
    assessClinicalRoutine('My face gets oily through the day.', { concerns: ['oiliness'] }),
    [],
    { concernSlugs: ['oily-congested-skin'] },
  );

  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.approvedUseIds, []);
});

test('a canonical concern cannot override an explicit product-step request', () => {
  const cleanser = product('cerave-foaming-facial-cleanser');
  const matchingStep = evaluateProductClinically(
    cleanser,
    assessClinicalRoutine('I need a cleanser for oily skin.', { concerns: ['oiliness'] }),
    [],
    { concernSlugs: ['oily-congested-skin'], productSteps: ['Cleanse'] },
  );
  const wrongStep = evaluateProductClinically(
    cleanser,
    assessClinicalRoutine('I need sunscreen for oily skin.', { concerns: ['oiliness'] }),
    [],
    { concernSlugs: ['oily-congested-skin'], productSteps: ['Protect'] },
  );

  assert.equal(matchingStep.eligible, true);
  assert.equal(wrongStep.eligible, false);
  assert.deepEqual(wrongStep.approvedUseIds, []);
});

test('a reviewed retinoid remains blocked during pregnancy', () => {
  const reviewedRetinoid: Product = {
    ...product('cerave-foaming-facial-cleanser'),
    verifiedIngredientIds: ['retinol'],
  };
  const clinical = assessClinicalRoutine('My face gets oily through the day.', {
    pregnant: true,
    concerns: ['oiliness'],
  });
  const decision = evaluateProductClinically(reviewedRetinoid, clinical);

  assert.equal(decision.careState, 'supportive_eligible');
  assert.equal(decision.ingredientIds.includes('retinol'), true);
  assert.equal(decision.eligible, false);
  assert.match(decision.exclusions.join(' '), /blocked ingredient.*retinol/i);
});

test('all five pharmacist-review products are excluded from direct recommendations', () => {
  const pharmacistSlugs = [
    'anua-niacinamide-10-txa-4-serum',
    'cerave-blemish-control-cleanser',
    'the-ordinary-azelaic-acid-suspension-10',
    'panoxyl-acne-foaming-wash-10-benzoyl-peroxide',
    'nizoral-ad-ketoconazole-shampoo',
  ];
  const clinical = assessClinicalRoutine('I have oily, dry skin, dark spots, acne and dandruff.', {
    concerns: ['oiliness', 'dryness', 'hyperpigmentation', 'dark spots', 'acne', 'dandruff'],
  });

  for (const slug of pharmacistSlugs) {
    const decision = evaluateProductClinically(product(slug), clinical);
    assert.equal(decision.careState, 'pharmacist_review', slug);
    assert.equal(decision.eligible, false, slug);
    assert.match(decision.exclusions.join(' '), /pharmacist review/i, slug);
  }
});
