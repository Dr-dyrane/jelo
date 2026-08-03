import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogueIdentityIdForProductId,
  catalogueIdentityVersionIdForProductId,
  resolveCatalogueIdentityVersion,
  type CatalogueIdentityTransitionRecord,
  type CatalogueIdentityVersionRecord,
} from '@/lib/catalogue/product-identity-resolver';

const productIds = {
  original: '10000000-0000-4000-8000-000000000001',
  current: '10000000-0000-4000-8000-000000000002',
  successor: '10000000-0000-4000-8000-000000000003',
};

function record(
  productId: string,
  overrides: Partial<CatalogueIdentityVersionRecord> = {},
): CatalogueIdentityVersionRecord {
  return {
    identityId: catalogueIdentityIdForProductId(productId),
    identityVersionId: catalogueIdentityVersionIdForProductId(productId),
    productId,
    versionNumber: 1,
    provenance: 'jelocare_reviewed',
    publicEligibilityBasis: 'reviewed_catalogue_projection',
    publicEligibleAt: '2026-08-02T12:00:00.000Z',
    slugAtReview: 'reviewed-product',
    brandAtReview: 'Reviewed brand',
    variantAtReview: 'Reviewed variant',
    sizeAtReview: '50 ml',
    packageVersionAtReview: 'reviewed-baseline-v1:static-v1',
    formulaVersionAtReview: 'reviewed-baseline-v1:static-v1',
    lifecycleState: 'active',
    retiredAt: null,
    retirementReasonCategory: null,
    ...overrides,
  };
}

function transition(
  from: CatalogueIdentityVersionRecord,
  to: CatalogueIdentityVersionRecord,
  kind: 'alias' | 'successor',
): CatalogueIdentityTransitionRecord {
  return {
    fromIdentityVersionId: from.identityVersionId,
    toIdentityVersionId: to.identityVersionId,
    kind,
    reasonCategory: kind === 'alias' ? 'reviewed_duplicate_merge' : 'reviewed_reformulation',
  };
}

test('deterministic backfill identity survives repeat runs and mutable slug or display copy', () => {
  const productId = productIds.original;
  const firstIdentity = catalogueIdentityIdForProductId(productId);
  const firstVersion = catalogueIdentityVersionIdForProductId(productId);

  assert.equal(catalogueIdentityIdForProductId(productId.toUpperCase()), firstIdentity);
  assert.equal(catalogueIdentityVersionIdForProductId(productId), firstVersion);

  const before = record(productId);
  const after = record(productId, {
    slugAtReview: 'new-public-route-copy',
    variantAtReview: 'Updated display copy',
  });
  assert.equal(before.identityId, after.identityId);
  assert.equal(before.identityVersionId, after.identityVersionId);
});

test('an active reviewed public identity resolves as the original and current version', () => {
  const current = record(productIds.original);
  const result = resolveCatalogueIdentityVersion(
    current.identityVersionId,
    [current],
    [],
  );

  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.transitionState, 'current');
  assert.equal(result.original.identityVersionId, current.identityVersionId);
  assert.equal(result.current.identityVersionId, current.identityVersionId);
  assert.equal(result.current.provenance, 'jelocare_reviewed');
  assert.equal(result.current.purchasable, true);
  assert.equal(result.successor, null);
});

test('a merge preserves the saved identity and resolves its explicit canonical alias', () => {
  const original = record(productIds.original, { lifecycleState: 'merged' });
  const current = record(productIds.current, { slugAtReview: 'canonical-product' });
  const result = resolveCatalogueIdentityVersion(
    original.identityVersionId,
    [original, current],
    [transition(original, current, 'alias')],
  );

  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.transitionState, 'merged');
  assert.equal(result.original.identityVersionId, original.identityVersionId);
  assert.equal(result.current.identityVersionId, current.identityVersionId);
  assert.equal(result.transitions[0]?.kind, 'alias');
});

test('retirement resolves a renderable non-purchasable tombstone', () => {
  const retired = record(productIds.original, {
    lifecycleState: 'retired',
    retiredAt: '2026-08-03T12:00:00.000Z',
    retirementReasonCategory: 'catalogue_projection_retirement',
  });
  const result = resolveCatalogueIdentityVersion(
    retired.identityVersionId,
    [retired],
    [],
  );

  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.transitionState, 'retired');
  assert.equal(result.current.variantAtReview, 'Reviewed variant');
  assert.equal(result.current.purchasable, false);
  assert.equal(result.current.retirementReasonCategory, 'catalogue_projection_retirement');
});

test('a reformulation returns an explicit successor without substituting the saved version', () => {
  const original = record(productIds.original, { lifecycleState: 'superseded' });
  const successor = record(productIds.successor, {
    identityId: original.identityId,
    versionNumber: 2,
    sizeAtReview: '60 ml',
    packageVersionAtReview: 'reviewed-package-v2',
    formulaVersionAtReview: 'reviewed-formula-v2',
  });
  const result = resolveCatalogueIdentityVersion(
    original.identityVersionId,
    [original, successor],
    [transition(original, successor, 'successor')],
  );

  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.transitionState, 'successor_available');
  assert.equal(result.current.identityVersionId, original.identityVersionId);
  assert.equal(result.current.purchasable, false);
  assert.equal(result.successor?.identityVersionId, successor.identityVersionId);
  assert.equal(result.successor?.versionNumber, 2);
});

test('transition cycles and ambiguous outgoing edges fail closed', () => {
  const first = record(productIds.original, { lifecycleState: 'merged' });
  const second = record(productIds.current, { lifecycleState: 'merged' });
  const third = record(productIds.successor);

  assert.deepEqual(
    resolveCatalogueIdentityVersion(
      first.identityVersionId,
      [first, second],
      [transition(first, second, 'alias'), transition(second, first, 'alias')],
    ),
    { status: 'unresolvable', reason: 'transition-cycle' },
  );

  assert.deepEqual(
    resolveCatalogueIdentityVersion(
      first.identityVersionId,
      [first, second, third],
      [transition(first, second, 'alias'), transition(first, third, 'alias')],
    ),
    { status: 'unresolvable', reason: 'ambiguous-transition' },
  );
});

test('only reviewed or explicitly released community public provenance resolves', () => {
  const reviewed = record(productIds.original);
  const communityPublic = record(productIds.current, {
    provenance: 'community_sourced_public',
    publicEligibilityBasis: 'community_publication_release',
  });
  const privateCandidate = record(productIds.successor, {
    provenance: 'community_candidate',
    publicEligibilityBasis: 'private_candidate',
  });

  assert.equal(
    resolveCatalogueIdentityVersion(reviewed.identityVersionId, [reviewed], []).status,
    'resolved',
  );
  assert.equal(
    resolveCatalogueIdentityVersion(
      communityPublic.identityVersionId,
      [communityPublic],
      [],
    ).status,
    'resolved',
  );
  assert.deepEqual(
    resolveCatalogueIdentityVersion(
      privateCandidate.identityVersionId,
      [privateCandidate],
      [],
    ),
    { status: 'unresolvable', reason: 'invalid-record' },
  );
  assert.deepEqual(
    resolveCatalogueIdentityVersion(
      '20000000-0000-4000-8000-000000000001',
      [reviewed, communityPublic],
      [],
    ),
    { status: 'unresolvable', reason: 'not-public-or-missing' },
  );
});
