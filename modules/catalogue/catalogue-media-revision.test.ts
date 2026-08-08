import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogueIntakeCandidate } from '@/lib/catalogue/intake-readiness';
import {
  assertCatalogueMediaRevisionCandidateTransition,
  parseCatalogueMediaRevisionManifest,
} from '@/scripts/revise-catalogue-publication-media';

const candidateId = 'naturium-kp-body-scrub-mask-8oz';
const priorEvidenceSha256 = 'a'.repeat(64);
const correctedEvidenceSha256 = 'b'.repeat(64);
const identityReviewedAt = '2026-08-08T14:35:44Z';
const careReviewedAt = '2026-08-08T14:36:00Z';
const artReviewedAt = '2026-08-08T15:17:00Z';
const asOf = Date.parse('2026-08-08T16:00:00Z');

function revisionManifest(identityCorrection: unknown = undefined) {
  return {
    schemaVersion: 1,
    revisions: [{
      candidateId,
      expectedCandidateSourceSha256: 'c'.repeat(64),
      expectedPublicationSourceSha256: 'd'.repeat(64),
      ...(identityCorrection === undefined ? {} : { identityCorrection }),
      artReviewedAt,
      approvedAt: '2026-08-08T15:18:00Z',
      presentationReviewedAt: '2026-08-08T15:19:00Z',
      publishedAt: '2026-08-08T15:20:00Z',
    }],
  };
}

function correctionAuthority() {
  return {
    from: {
      size: '8 oz / 226 mL',
      packageVersion: 'KP Body Scrub & Mask 8 oz / 226 mL jar',
      evidenceSha256: priorEvidenceSha256,
      evidenceByteSize: 1907,
    },
    to: {
      size: '8 oz / 226 g',
      packageVersion: 'KP Body Scrub & Mask 8 oz / 226 g tube',
      evidenceSha256: correctedEvidenceSha256,
      evidenceByteSize: 1916,
      reviewedAt: identityReviewedAt,
      reviewer: 'JeloCare catalogue identity correction review',
    },
    careReview: {
      from: {
        reviewedAt: '2026-08-07T13:08:00Z',
        reviewer: 'JeloCare catalogue evidence review',
      },
      to: {
        reviewedAt: careReviewedAt,
        reviewer: 'JeloCare catalogue care recheck',
      },
    },
  };
}

function priorCandidateFixture() {
  return {
    id: candidateId,
    brand: 'Naturium',
    name: 'KP Body Scrub & Mask',
    variant: 'KP Body Scrub & Mask',
    size: '8 oz / 226 mL',
    category: 'Body care',
    reason: 'Reviewed candidate.',
    priority: 'important',
    gapIds: ['kp-body-scrub'],
    demandEvidenceUrls: ['https://naturium.com/products/kp-body-scrub-mask'],
    identity: {
      gtin: '810120260044',
      officialProductUrl: 'https://naturium.com/products/kp-body-scrub-mask',
      checkedAt: '2026-08-07T13:08:00Z',
      basis: 'official-brand',
      packageVersion: 'KP Body Scrub & Mask 8 oz / 226 mL jar',
      officialEvidence: {
        url: 'https://naturium.com/products/kp-body-scrub-mask',
        observedGtin: '810120260044',
        observedVariant: 'KP Body Scrub & Mask',
        observedSize: '8 oz / 226 mL',
        observedPackageVersion: 'KP Body Scrub & Mask 8 oz / 226 mL jar',
        snapshotKind: 'canonical-extraction',
        snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
        snapshotSha256: priorEvidenceSha256,
        snapshotMimeType: 'application/json',
        snapshotByteSize: 1907,
        retrievedAt: '2026-08-07T13:06:28Z',
        canonicalExtraction: {
          schemaVersion: 4,
          candidateId,
          method: 'reviewed-browser-dom-identity-field-extraction',
          sourceUrl: 'https://naturium.com/products/kp-body-scrub-mask',
          responseUrl: 'https://naturium.com/products/kp-body-scrub-mask',
          retrievedAt: '2026-08-07T13:06:28Z',
          reviewedAt: '2026-08-07T13:08:00Z',
          reviewer: 'JeloCare catalogue evidence review',
          sourceResponseSha256: 'e'.repeat(64),
          sourceResponseMimeType: 'text/html',
          sourceResponseByteSize: 852102,
          responseDigestScope: 'rendered-dom-outerhtml',
          browserCapture: {
            surface: 'Playwright MCP browser',
            documentReadyState: 'complete',
            pageTitle: 'KP Body Scrub & Mask | Naturium',
          },
          fields: {
            gtin: {
              value: '810120260044',
              locator: 'structured barcode',
              sourceText: '"barcode":"810120260044"',
            },
            variant: {
              value: 'KP Body Scrub & Mask',
              locator: 'product title',
              sourceText: 'KP Body Scrub & Mask',
            },
            size: {
              value: '8 oz / 226 mL',
              locator: 'front pack',
              sourceText: '8 OZ / 226 mL',
            },
            packageVersion: {
              value: 'KP Body Scrub & Mask 8 oz / 226 mL jar',
              locator: 'front pack',
              sourceText: 'KP Body Scrub & Mask 8 OZ / 226 mL jar',
            },
          },
        },
      },
    },
    care: {
      status: 'reviewed',
      evidenceUrls: ['https://naturium.com/products/kp-body-scrub-mask'],
      reviewedAt: '2026-08-07T13:08:00Z',
      reviewer: 'JeloCare catalogue evidence review',
    },
    nigeria: {
      regulatoryStatus: 'pending',
      exactOffers: [],
      excludedObservations: [],
    },
    asset: {
      rightsStatus: 'documented',
      publicImageSha256: 'f'.repeat(64),
      artReviewedAt: '2026-08-07T14:59:46Z',
    },
  };
}

function correctedCandidateFixture() {
  const candidate = structuredClone(priorCandidateFixture());
  candidate.size = '8 oz / 226 g';
  candidate.identity.checkedAt = identityReviewedAt;
  candidate.identity.packageVersion = 'KP Body Scrub & Mask 8 oz / 226 g tube';
  candidate.identity.officialEvidence.observedSize = '8 oz / 226 g';
  candidate.identity.officialEvidence.observedPackageVersion = (
    'KP Body Scrub & Mask 8 oz / 226 g tube'
  );
  candidate.identity.officialEvidence.snapshotSha256 = correctedEvidenceSha256;
  candidate.identity.officialEvidence.snapshotByteSize = 1916;
  const extraction = candidate.identity.officialEvidence.canonicalExtraction;
  extraction.reviewedAt = identityReviewedAt;
  extraction.reviewer = 'JeloCare catalogue identity correction review';
  extraction.fields.size.value = '8 oz / 226 g';
  extraction.fields.size.sourceText = '8 OZ / 226 G';
  extraction.fields.packageVersion.value = 'KP Body Scrub & Mask 8 oz / 226 g tube';
  extraction.fields.packageVersion.sourceText = 'KP Body Scrub & Mask 8 OZ / 226 G tube';
  candidate.care.reviewedAt = careReviewedAt;
  candidate.care.reviewer = 'JeloCare catalogue care recheck';
  candidate.asset.publicImageSha256 = '0'.repeat(64);
  candidate.asset.artReviewedAt = artReviewedAt;
  return candidate;
}

function asCandidate(value: ReturnType<typeof priorCandidateFixture>) {
  return value as unknown as CatalogueIntakeCandidate;
}

test('the manifest parser accepts one exact-bound identity correction authority', () => {
  const parsed = parseCatalogueMediaRevisionManifest(
    revisionManifest(correctionAuthority()),
    asOf,
  );
  assert.equal(parsed.revisions[0].identityCorrection?.to.size, '8 oz / 226 g');
  assert.equal(
    parsed.revisions[0].identityCorrection?.to.evidenceSha256,
    correctedEvidenceSha256,
  );
  assert.equal(
    parsed.revisions[0].identityCorrection?.careReview?.to.reviewedAt,
    careReviewedAt,
  );
});

test('identity correction authority rejects unsupported scope and late review', () => {
  const unsupported = correctionAuthority() as ReturnType<typeof correctionAuthority> & {
    reason?: string;
  };
  unsupported.reason = 'expand the correction';
  assert.throws(
    () => parseCatalogueMediaRevisionManifest(revisionManifest(unsupported), asOf),
    /unsupported fields: reason/,
  );

  const late = correctionAuthority();
  late.to.reviewedAt = '2026-08-08T15:17:01Z';
  assert.throws(
    () => parseCatalogueMediaRevisionManifest(revisionManifest(late), asOf),
    /must not follow art review/,
  );
});

test('care recheck authority must advance the old review within identity and art review', () => {
  const beforeIdentity = correctionAuthority();
  beforeIdentity.careReview.to.reviewedAt = '2026-08-08T14:35:43Z';
  assert.throws(
    () => parseCatalogueMediaRevisionManifest(revisionManifest(beforeIdentity), asOf),
    /not predate the identity correction/,
  );

  const afterArt = correctionAuthority();
  afterArt.careReview.to.reviewedAt = '2026-08-08T15:17:01Z';
  assert.throws(
    () => parseCatalogueMediaRevisionManifest(revisionManifest(afterArt), asOf),
    /not follow art review/,
  );
});

test('media-only revisions remain media-only by default', () => {
  const previous = priorCandidateFixture();
  const mediaOnly = structuredClone(previous);
  mediaOnly.asset.publicImageSha256 = '0'.repeat(64);
  const revision = parseCatalogueMediaRevisionManifest(revisionManifest(), asOf).revisions[0];
  assert.doesNotThrow(() => assertCatalogueMediaRevisionCandidateTransition(
    asCandidate(previous),
    asCandidate(mediaOnly),
    revision,
    '2026-08-07T15:02:00Z',
  ));

  mediaOnly.size = '8 oz / 226 g';
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(previous),
      asCandidate(mediaOnly),
      revision,
      '2026-08-07T15:02:00Z',
    ),
    /changes non-media candidate fields/,
  );
});

test('the exact KP size, package, evidence, and media transition passes', () => {
  const revision = parseCatalogueMediaRevisionManifest(
    revisionManifest(correctionAuthority()),
    asOf,
  ).revisions[0];
  assert.doesNotThrow(() => assertCatalogueMediaRevisionCandidateTransition(
    asCandidate(priorCandidateFixture()),
    asCandidate(correctedCandidateFixture()),
    revision,
    '2026-08-08T14:34:00Z',
  ));
});

test('an identity correction cannot alter unrelated identity or predate publication', () => {
  const revision = parseCatalogueMediaRevisionManifest(
    revisionManifest(correctionAuthority()),
    asOf,
  ).revisions[0];
  const unrelated = correctedCandidateFixture();
  unrelated.identity.gtin = '810120260045';
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(priorCandidateFixture()),
      asCandidate(unrelated),
      revision,
      '2026-08-08T14:34:00Z',
    ),
    /outside the reviewed boundary/,
  );
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(priorCandidateFixture()),
      asCandidate(correctedCandidateFixture()),
      revision,
      identityReviewedAt,
    ),
    /must follow the prior publication/,
  );
});

test('care recheck changes only review metadata and requires exact authority', () => {
  const revision = parseCatalogueMediaRevisionManifest(
    revisionManifest(correctionAuthority()),
    asOf,
  ).revisions[0];
  const contentDrift = correctedCandidateFixture();
  contentDrift.care.evidenceUrls.push('https://example.test/unreviewed-care-source');
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(priorCandidateFixture()),
      asCandidate(contentDrift),
      revision,
      '2026-08-08T14:34:00Z',
    ),
    /outside the reviewed boundary/,
  );

  const wrongReviewer = correctedCandidateFixture();
  wrongReviewer.care.reviewer = 'Unbound care reviewer';
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(priorCandidateFixture()),
      asCandidate(wrongReviewer),
      revision,
      '2026-08-08T14:34:00Z',
    ),
    /corrected care review does not match the reviewed manifest/,
  );

  const authority = correctionAuthority();
  const identityOnlyRevision = parseCatalogueMediaRevisionManifest(
    revisionManifest({ from: authority.from, to: authority.to }),
    asOf,
  ).revisions[0];
  assert.throws(
    () => assertCatalogueMediaRevisionCandidateTransition(
      asCandidate(priorCandidateFixture()),
      asCandidate(correctedCandidateFixture()),
      identityOnlyRevision,
      '2026-08-08T14:34:00Z',
    ),
    /outside the reviewed boundary/,
  );
});
