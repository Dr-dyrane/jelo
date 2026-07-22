import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCatalogueIntakeManifest,
  catalogueIntakeSchemaVersion,
  evaluateCatalogueIntakeCandidate,
  rankCatalogueIntake,
  type CatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';

const asOf = Date.parse('2026-07-22T12:00:00Z');
const hash = 'a'.repeat(64);

function completeCandidate(overrides: Partial<CatalogueIntakeCandidate> = {}): CatalogueIntakeCandidate {
  const base: CatalogueIntakeCandidate = {
    id: 'example-barrier-lotion',
    brand: 'Example',
    name: 'Barrier Lotion',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    category: 'Body care',
    reason: 'Closes the reviewed daily body-moisture gap with a locally observed exact product.',
    priority: 'essential',
    gapIds: ['body-dryness', 'barrier-support'],
    demandEvidenceUrls: ['https://research.example/demand/example'],
    identity: {
      gtin: '4005808319695',
      officialProductUrl: 'https://brand.example/products/barrier-lotion',
      checkedAt: '2026-07-22T08:00:00Z',
      basis: 'official-brand',
    },
    care: {
      status: 'reviewed',
      formulaArchetype: 'Daily bland emollient',
      evidenceUrls: ['https://brand.example/products/barrier-lotion'],
      reviewedAt: '2026-07-22T08:30:00Z',
      reviewer: 'Care reviewer',
    },
    nigeria: {
      regulatoryStatus: 'matched',
      regulatoryEvidenceUrl: 'https://regulator.example/products/4005808319695',
      brandAuthorizationEvidenceUrl: 'https://brand.example/nigeria/retailers',
      exactOffers: [{
        retailer: 'Nigeria Store',
        retailerStatus: 'directory-listed',
        listingUrl: 'https://store.example/products/example-barrier-lotion',
        observedAt: '2026-07-22T09:00:00Z',
        observedTitle: 'Example Barrier Lotion',
        observedSize: '13.5 fl oz / 400 ml',
        priceNgn: 12_500,
        stock: 'in-stock',
      }],
    },
    asset: {
      rightsStatus: 'documented',
      origin: 'identity-verified-styled-composite',
      rightsUrl: 'https://brand.example/media-permission',
      sourceUrl: 'https://brand.example/media/barrier-lotion.png',
      publicImageUrl: 'https://assets.example/products/barrier-lotion.webp',
      publicImageSha256: hash,
      width: 1_800,
      height: 2_000,
      packaging: 'intact',
      backgroundTreatment: 'styled-composite',
      labelVariantSizeUnchanged: true,
      packagingInvented: false,
      manualSourceOutputQa: true,
      presentationQuality: 'magazine-ready',
    },
  };
  return { ...base, ...overrides };
}

test('intake fails at exact identity before later research gates', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    identity: { ...base.identity, gtin: undefined, officialProductUrl: undefined },
    care: { status: 'pending', evidenceUrls: [] },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'identity');
  assert.equal(decision.approvalDraftReady, false);
  assert.ok(decision.blockers.includes('identity-gtin-missing-or-invalid'));
  assert.ok(decision.blockers.includes('care-review-missing'));
  assert.match(decision.nextAction, /exact GTIN/i);
});

test('care review remains a distinct gate after identity is locked', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = { ...base, care: { status: 'pending', evidenceUrls: [] } };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'care');
  assert.ok(decision.blockers.includes('care-evidence-missing'));
});

test('only fresh exact Nigerian title and size evidence advances the market gate', () => {
  const base = completeCandidate();
  const stale: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({ ...offer, observedAt: '2026-07-10T09:00:00Z' })),
    },
  };
  const mismatched: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({ ...offer, observedSize: '200 ml' })),
    },
  };

  for (const item of [stale, mismatched]) {
    const decision = evaluateCatalogueIntakeCandidate(item, asOf);
    assert.equal(decision.stage, 'nigeria');
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('nigeria-exact-offer-missing'));
  }
});

test('a provisional observation cannot satisfy the independent Tier-A route', () => {
  const base = completeCandidate();
  const secondOffer = {
    ...base.nigeria.exactOffers[0],
    retailer: 'Provisional Store',
    retailerStatus: 'provisional' as const,
    listingUrl: 'https://provisional.example/products/example-barrier-lotion',
  };
  const item: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: undefined,
      tierAIdentityEvidenceUrl: 'https://identity.example/nigeria-retailers',
      exactOffers: [...base.nigeria.exactOffers, secondOffer],
    },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.stage, 'nigeria');
  assert.ok(decision.blockers.includes('nigeria-market-route-insufficient'));

  const independentlyListed = evaluateCatalogueIntakeCandidate({
    ...item,
    nigeria: {
      ...item.nigeria,
      exactOffers: item.nigeria.exactOffers.map(offer => ({ ...offer, retailerStatus: 'directory-listed' })),
    },
  }, asOf);
  assert.equal(independentlyListed.stage, 'approval-ready');
});

test('a raw background-removed packshot cannot become the final image', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    asset: { ...base.asset, backgroundTreatment: 'automated-removal' },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'editorial');
  assert.ok(decision.blockers.includes('asset-automated-cutout'));
  assert.equal(decision.approvalDraftReady, false);
});

test('a reviewed source-pixel isolation may advance without treating redraw as acceptable', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    asset: { ...base.asset, backgroundTreatment: 'source-pixel-isolation' },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
});

test('a fully bound candidate becomes ready only for an approval draft', () => {
  const decision = evaluateCatalogueIntakeCandidate(completeCandidate(), asOf);

  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.approvalDraftReady, true);
});

test('the review queue honors deliberate cohort priority without changing gate status', () => {
  const essential = evaluateCatalogueIntakeCandidate(completeCandidate({
    id: 'essential-unresolved',
    identity: {},
  }), asOf);
  const exploratory = evaluateCatalogueIntakeCandidate(completeCandidate({
    id: 'exploratory-ready',
    priority: 'exploratory',
    identity: { ...completeCandidate().identity, gtin: '0302994113002' },
  }), asOf);
  const ranked = rankCatalogueIntake([exploratory, essential]);

  assert.equal(ranked[0].candidate.id, 'essential-unresolved');
  assert.equal(ranked[0].stage, 'identity');
  assert.equal(ranked[1].stage, 'approval-ready');
});

test('the manifest rejects duplicate identities before review work starts', () => {
  const item = completeCandidate();
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [item, { ...item, id: 'another-id' }],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake GTIN/);
});
