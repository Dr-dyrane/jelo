import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  catalogueExactOfferEvidenceSchemaVersion,
  catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
  reviewedExactOfferEvidenceValid,
  type ExactOfferEvidenceSubject,
  type ReviewedExactOfferEvidence,
  type ReviewedRetainedGtinExactOfferEvidence,
} from '@/lib/catalogue/market-evidence';

const asOf = Date.parse('2026-07-27T12:00:00Z');
const gtin = '4005808319695';
const listingUrl = 'https://medplusnig.com/product/example-barrier-lotion';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function fields() {
  return {
    gtin: {
      label: 'GTIN' as const,
      value: gtin,
      locator: 'JSON product record gtin field',
      sourceText: `GTIN ${gtin}`,
    },
    title: {
      value: 'Example Barrier Lotion',
      locator: 'JSON product record title field',
      sourceText: 'Example Barrier Lotion',
    },
    size: {
      value: '400 ml',
      locator: 'JSON product record size field',
      sourceText: '400 ml',
    },
    price: {
      value: 12_500,
      currency: 'NGN' as const,
      locator: 'JSON product record price field',
      sourceText: 'NGN 12,500',
    },
    stock: {
      value: 'in-stock' as const,
      locator: 'JSON product record stock field',
      sourceText: 'In stock',
    },
  };
}

function legacyEvidence(): ReviewedExactOfferEvidence {
  return {
    schemaVersion: catalogueExactOfferEvidenceSchemaVersion,
    method: 'reviewed-exact-offer-field-extraction',
    listingUrl,
    responseUrl: listingUrl,
    responseSha256: 'a'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'application/json',
    responseByteSize: 2_048,
    retrievedAt: '2026-07-27T11:00:00Z',
    fields: fields(),
    reviewer: 'Market reviewer',
    reviewedAt: '2026-07-27T11:05:00Z',
  };
}

function retainedEvidence(): ReviewedRetainedGtinExactOfferEvidence {
  const sourceText = JSON.stringify({
    id: 1842,
    permalink: listingUrl,
    gtin,
    title: 'Example Barrier Lotion',
    size: '400 ml',
    price: 'NGN 12,500',
    stock: 'In stock',
  });
  const responseByteSize = Buffer.byteLength(sourceText, 'utf8');
  return {
    ...legacyEvidence(),
    schemaVersion: catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
    responseUrl:
      'https://medplusnig.com/wp-json/wc/store/v1/products/1842',
    responseSha256: sha256(sourceText),
    responseByteSize,
    responseSnapshotPath:
      'data/catalogue-offer-source-evidence/example-barrier-lotion--medplus.json',
    offerRecord: {
      locator: 'Complete exact Woo Store API product response',
      byteStart: 0,
      byteEnd: responseByteSize,
      sourceText,
      sourceFragmentSha256: sha256(sourceText),
    },
  };
}

function withCompleteBody(
  evidence: ReviewedRetainedGtinExactOfferEvidence,
  sourceText: string,
) {
  const responseByteSize = Buffer.byteLength(sourceText, 'utf8');
  const responseSha256 = sha256(sourceText);
  return {
    ...evidence,
    responseSha256,
    responseByteSize,
    offerRecord: {
      ...evidence.offerRecord,
      byteStart: 0,
      byteEnd: responseByteSize,
      sourceText,
      sourceFragmentSha256: responseSha256,
    },
  };
}

function offer(
  evidence: ExactOfferEvidenceSubject['evidence'],
): ExactOfferEvidenceSubject {
  return {
    listingUrl,
    observedAt: '2026-07-27T11:00:00Z',
    observedTitle: 'Example Barrier Lotion',
    observedSize: '400 ml',
    observedGtin: gtin,
    observedGtinBasis: 'explicit-gtin',
    priceNgn: 12_500,
    stock: 'in-stock',
    evidence,
  };
}

test('schema 1 GTIN exact-offer evidence remains valid without retained response metadata', () => {
  const evidence = legacyEvidence();

  assert.equal('responseSnapshotPath' in evidence, false);
  assert.equal('offerRecord' in evidence, false);
  assert.equal(reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf), true);
});

test('schema 4 accepts a canonical snapshot path and hash-bound complete product body', () => {
  const evidence = retainedEvidence();

  assert.equal(
    reviewedExactOfferEvidenceValid(
      offer(evidence),
      { kind: 'gtin', value: gtin },
      asOf,
    ),
    true,
  );
});

test('schema 4 accepts a raw Woo minor-unit price object without converting it into synthetic copy', () => {
  const evidence = retainedEvidence();
  evidence.fields.price.sourceText = JSON.stringify({
    price: '1250000',
    currency_code: 'NGN',
    currency_minor_unit: 2,
  });

  assert.equal(
    reviewedExactOfferEvidenceValid(
      offer(evidence),
      { kind: 'gtin', value: gtin },
      asOf,
    ),
    true,
  );
  evidence.fields.price.sourceText = JSON.stringify({
    price: '1250000',
    currency_code: 'USD',
    currency_minor_unit: 2,
  });
  assert.equal(
    reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf),
    false,
  );
});

test('schema 4 rejects missing, escaping, or MIME-inconsistent snapshot paths', () => {
  const valid = retainedEvidence();
  const invalidPaths = [
    undefined,
    '../catalogue-offer-source-evidence/example--medplus.json',
    'data/catalogue-offer-source-evidence/example--medplus.html',
    'data/catalogue-offer-source-evidence/Example--medplus.json',
    'data/catalogue-offer-source-evidence/example.json',
  ];

  for (const responseSnapshotPath of invalidPaths) {
    const evidence = {
      ...valid,
      responseSnapshotPath,
    } as unknown as ReviewedRetainedGtinExactOfferEvidence;
    assert.equal(
      reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf),
      false,
      String(responseSnapshotPath),
    );
  }
});

test('schema 4 rejects invalid response URL and response digest metadata', () => {
  const valid = retainedEvidence();
  const invalidEvidence = [
    { ...valid, responseUrl: 'https://attacker.example/offer' },
    { ...valid, responseSha256: 'not-a-sha256' },
    { ...valid, responseByteSize: 0 },
    { ...valid, responseByteSize: 2_048.5 },
  ];

  for (const evidence of invalidEvidence) {
    assert.equal(
      reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf),
      false,
    );
  }
});

test('schema 4 accepts only a queryless same-retailer Woo Store API product record', () => {
  const valid = retainedEvidence();
  const invalidResponseUrls = [
    'https://attacker.example/wp-json/wc/store/v1/products/1842',
    'https://medplusnig.com/product/example-barrier-lotion',
    'https://medplusnig.com/wp-json/wc/store/v1/products',
    'https://medplusnig.com/wp-json/wc/store/v1/products/',
    'https://medplusnig.com/wp-json/wc/store/v1/products/1842/reviews',
    'https://medplusnig.com/wp-json/wc/store/v1/products/1842?context=view',
    'https://medplusnig.com/wp-json/wc/store/v1/products/1842#record',
    'https://medplusnig.com/wp-json/wc/store/v1/products/0',
    'https://medplusnig.com/wp-json/wc/store/v1/products/-1',
    'https://medplusnig.com/wp-json/wc/store/v1/products/01',
    'https://medplusnig.com/wp-json/wc/store/v1/products/not-an-id',
  ];

  assert.equal(reviewedExactOfferEvidenceValid(offer(valid), gtin, asOf), true);
  for (const responseUrl of invalidResponseUrls) {
    assert.equal(
      reviewedExactOfferEvidenceValid(
        offer({ ...valid, responseUrl }),
        gtin,
        asOf,
      ),
      false,
      responseUrl,
    );
  }
});

test('schema 4 rejects HTML and browser-derived captures of the Woo product route', () => {
  const valid = retainedEvidence();
  const htmlEvidence = {
    ...valid,
    responseMimeType: 'text/html' as const,
    responseSnapshotPath:
      'data/catalogue-offer-source-evidence/example-barrier-lotion--medplus.html',
  };
  const browserEvidence = {
    ...htmlEvidence,
    method: 'reviewed-browser-dom-exact-offer-field-extraction' as const,
    responseDigestScope: 'rendered-dom-outerhtml' as const,
    browserCapture: {
      surface: 'Codex in-app browser' as const,
      documentReadyState: 'complete' as const,
      pageTitle: 'Example Barrier Lotion API response',
    },
  };

  assert.equal(
    reviewedExactOfferEvidenceValid(offer(htmlEvidence), gtin, asOf),
    false,
  );
  assert.equal(
    reviewedExactOfferEvidenceValid(offer(browserEvidence), gtin, asOf),
    false,
  );
});

test('schema 1 keeps requiring the response URL to equal the listing URL', () => {
  const evidence = legacyEvidence();
  evidence.responseUrl =
    'https://medplusnig.com/wp-json/wc/store/v1/products/1842';

  assert.equal(reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf), false);
});

test('schema 4 rejects partial, out-of-bounds, length-mismatched, or digest-mismatched records', () => {
  const valid = retainedEvidence();
  const invalidRecords = [
    {
      ...valid.offerRecord,
      byteStart: 1,
    },
    {
      ...valid.offerRecord,
      byteEnd: valid.responseByteSize + 1,
    },
    {
      ...valid.offerRecord,
      byteEnd: valid.offerRecord.byteEnd - 1,
    },
    {
      ...valid.offerRecord,
      sourceText: `${valid.offerRecord.sourceText} `,
    },
    {
      ...valid.offerRecord,
      sourceFragmentSha256: 'b'.repeat(64),
    },
  ];

  for (const offerRecord of invalidRecords) {
    assert.equal(
      reviewedExactOfferEvidenceValid(
        offer({ ...valid, offerRecord }),
        gtin,
        asOf,
      ),
      false,
    );
  }
});

test('schema 4 rejects a sliced product inside a wrapper, an array, and invalid surrounding bytes', () => {
  const valid = retainedEvidence();
  const productSource = valid.offerRecord.sourceText;
  const prefix = '{"result":';
  const wrappedSource = `${prefix}${productSource}}`;
  const sliced = {
    ...valid,
    responseSha256: sha256(wrappedSource),
    responseByteSize: Buffer.byteLength(wrappedSource, 'utf8'),
    offerRecord: {
      ...valid.offerRecord,
      byteStart: Buffer.byteLength(prefix, 'utf8'),
      byteEnd: Buffer.byteLength(prefix + productSource, 'utf8'),
    },
  };
  assert.equal(reviewedExactOfferEvidenceValid(offer(sliced), gtin, asOf), false);

  const product = JSON.parse(productSource) as Record<string, unknown>;
  for (const sourceText of [
    JSON.stringify({ result: product }),
    JSON.stringify([product]),
    `${productSource}\nnot-json`,
  ]) {
    const evidence = withCompleteBody(valid, sourceText);
    assert.equal(
      reviewedExactOfferEvidenceValid(offer(evidence), gtin, asOf),
      false,
      sourceText,
    );
  }
});

test('schema 4 byte bounds use encoded UTF-8 size instead of JavaScript string length', () => {
  const evidence = retainedEvidence();
  const product = JSON.parse(evidence.offerRecord.sourceText) as Record<string, unknown>;
  const sourceText = JSON.stringify({ ...product, note: '· ₦12,500' });
  const rebound = withCompleteBody(evidence, sourceText);

  assert.notEqual(Buffer.byteLength(sourceText, 'utf8'), sourceText.length);
  assert.equal(reviewedExactOfferEvidenceValid(offer(rebound), gtin, asOf), true);
});
