import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  catalogueCanonicalIdentifierFor,
  catalogueCanonicalIdentifierKey,
  catalogueOfficialProductCrosswalkRouteClass,
  catalogueOfficialProductRoutePackageKey,
  catalogueOfficialProductCrosswalkSchemaVersion,
  catalogueOfficialRouteManufacturerProductKey,
  type CatalogueOfficialProductIdentityCrosswalk,
} from '@/lib/catalogue/canonical-identity';
import { verifyCatalogueIdentityEvidenceArtifacts } from '@/lib/catalogue/identity-evidence-artifact';
import {
  catalogueIdentityExtractionByteSize,
  catalogueIdentityExtractionCanonicalJson,
  catalogueIdentityExtractionSha256,
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  requiredIdentifierAbsenceTerms,
  type CatalogueIntakeCandidate,
  type CatalogueManufacturerSkuIdentityExtraction,
  type CatalogueOfficialManufacturerSkuIdentityEvidence,
} from '@/lib/catalogue/intake-readiness';
import {
  sourceTextNamesCatalogueBrandField,
  verifiedCatalogueRetainedRecord,
  type CatalogueRetainedRecord,
} from '@/lib/catalogue/retained-record';

const candidateId = 'example-barrier-lotion';
const officialProductUrl =
  'https://africa.cerave.com/en/our-products/moisturizers/example-barrier-lotion';
const productRecord = [
  '<article data-product-record>',
  '<p>Brand CeraVe</p>',
  '<h1>Example Barrier Lotion</h1>',
  '<p>SKU CER-BARRIER-400-A</p>',
  '<p>Size 400 ml</p>',
  '<p>Package Pump bottle 400 ml</p>',
  '</article>',
].join('');

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function retainedRecord(
  completeSource: string,
  fragment: string,
  locator: string,
): CatalogueRetainedRecord {
  const characterStart = completeSource.indexOf(fragment);
  assert.notEqual(characterStart, -1);
  const byteStart = Buffer.byteLength(completeSource.slice(0, characterStart));
  const byteEnd = byteStart + Buffer.byteLength(fragment);
  return {
    locator,
    byteStart,
    byteEnd,
    sourceText: fragment,
    sourceFragmentSha256: sha256(fragment),
  };
}

function manufacturerCandidate(source: string) {
  const extraction: CatalogueManufacturerSkuIdentityExtraction = {
    schemaVersion: catalogueManufacturerSkuIdentityExtractionSchemaVersion,
    candidateId,
    sourceUrl: officialProductUrl,
    responseUrl: officialProductUrl,
    retrievedAt: '2026-07-22T07:55:00Z',
    productRecord: retainedRecord(source, source.match(/<article[\s\S]*<\/article>/)?.[0] ?? '', 'article[data-product-record]'),
    fields: {
      manufacturerBrand: {
        value: 'CeraVe',
        locator: 'Rendered product brand',
        sourceText: 'Brand CeraVe',
      },
      manufacturerSku: {
        value: 'CER-BARRIER-400-A',
        label: 'SKU',
        locator: 'Rendered product metadata row labelled SKU',
        sourceText: 'SKU CER-BARRIER-400-A',
      },
      variant: {
        value: 'Example Barrier Lotion',
        locator: 'Rendered product heading',
        sourceText: 'Example Barrier Lotion',
      },
      size: {
        value: '400 ml',
        locator: 'Rendered product size',
        sourceText: 'Size 400 ml',
      },
      packageVersion: {
        value: 'Pump bottle 400 ml',
        locator: 'Rendered package description',
        sourceText: 'Package Pump bottle 400 ml',
      },
      gtinPublicationStatus: {
        value: 'not-published',
        locator: 'Complete rendered DOM identifier scan',
        sourceText: 'Identifier scan returned zero structured keys.',
        absenceProof: {
          searchScope: 'complete-rendered-dom-outerhtml',
          searchedTerms: [...requiredIdentifierAbsenceTerms],
          matchStrategy: 'structured-key-variants',
          caseInsensitive: true,
          matchCount: 0,
        },
      },
    },
    sourceResponseSha256: sha256(source),
    sourceResponseMimeType: 'text/html',
    sourceResponseByteSize: Buffer.byteLength(source),
    sourceSnapshotPath: `data/catalogue-identity-source-evidence/${candidateId}.html`,
    responseDigestScope: 'rendered-dom-outerhtml',
    method: 'reviewed-browser-dom-official-manufacturer-sku-identity',
    browserCapture: {
      surface: 'Codex in-app browser',
      documentReadyState: 'complete',
      pageTitle: 'Example Barrier Lotion | CeraVe',
    },
    reviewer: 'Identity reviewer',
    reviewedAt: '2026-07-22T07:58:00Z',
  };
  const evidence: CatalogueOfficialManufacturerSkuIdentityEvidence = {
    identityKind: 'manufacturer-sku',
    url: officialProductUrl,
    observedManufacturerSku: 'CER-BARRIER-400-A',
    observedManufacturerSkuLabel: 'SKU',
    observedVariant: 'Example Barrier Lotion',
    observedSize: '400 ml',
    observedPackageVersion: 'Pump bottle 400 ml',
    snapshotKind: 'canonical-extraction',
    snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
    snapshotSha256: catalogueIdentityExtractionSha256(extraction),
    snapshotMimeType: 'application/json',
    snapshotByteSize: catalogueIdentityExtractionByteSize(extraction),
    retrievedAt: extraction.retrievedAt,
    canonicalExtraction: extraction,
  };
  return {
    id: candidateId,
    brand: 'CeraVe',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    identity: { officialEvidence: evidence },
    nigeria: { exactOffers: [] },
  } as unknown as CatalogueIntakeCandidate;
}

function manufacturerJsonCandidate(source: string) {
  const extraction: CatalogueManufacturerSkuIdentityExtraction = {
    schemaVersion: catalogueManufacturerSkuIdentityExtractionSchemaVersion,
    candidateId,
    sourceUrl: officialProductUrl,
    responseUrl: `${officialProductUrl}.js?country=NG&currency=NGN&v=2`,
    retrievedAt: '2026-07-22T07:55:00Z',
    productRecord: retainedRecord(source, source, 'Complete official Shopify product response'),
    fields: {
      manufacturerBrand: {
        value: 'CeraVe',
        locator: 'Official product response vendor field',
        sourceText: '"vendor":"CeraVe"',
      },
      manufacturerSku: {
        value: 'CER-BARRIER-400-A',
        label: 'SKU',
        locator: 'Official product response variants[0].sku',
        sourceText: '"sku":"CER-BARRIER-400-A"',
      },
      variant: {
        value: 'Example Barrier Lotion',
        locator: 'Official product response title field',
        sourceText: '"title":"Example Barrier Lotion"',
      },
      size: {
        value: '400 ml',
        locator: 'Official product response option value',
        sourceText: '"option1":"400 ml"',
      },
      packageVersion: {
        value: 'Pump bottle 400 ml',
        locator: 'Official product response package version field',
        sourceText: '"package_version":"Pump bottle 400 ml"',
      },
      gtinPublicationStatus: {
        value: 'not-published',
        locator: 'Official product response variants[0].barcode null field',
        sourceText: '"sku":"CER-BARRIER-400-A","barcode":null',
      },
    },
    sourceResponseSha256: sha256(source),
    sourceResponseMimeType: 'text/javascript',
    sourceResponseByteSize: Buffer.byteLength(source),
    sourceSnapshotPath: `data/catalogue-identity-source-evidence/${candidateId}.json`,
    responseDigestScope: 'decoded-response-body',
    method: 'reviewed-exact-official-manufacturer-sku-response',
    reviewer: 'Identity reviewer',
    reviewedAt: '2026-07-22T07:58:00Z',
  };
  const evidence: CatalogueOfficialManufacturerSkuIdentityEvidence = {
    identityKind: 'manufacturer-sku',
    url: officialProductUrl,
    observedManufacturerSku: 'CER-BARRIER-400-A',
    observedManufacturerSkuLabel: 'SKU',
    observedVariant: 'Example Barrier Lotion',
    observedSize: '400 ml',
    observedPackageVersion: 'Pump bottle 400 ml',
    snapshotKind: 'canonical-extraction',
    snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
    snapshotSha256: catalogueIdentityExtractionSha256(extraction),
    snapshotMimeType: 'application/json',
    snapshotByteSize: catalogueIdentityExtractionByteSize(extraction),
    retrievedAt: extraction.retrievedAt,
    canonicalExtraction: extraction,
  };
  return {
    id: candidateId,
    brand: 'CeraVe',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    identity: { officialEvidence: evidence },
    nigeria: { exactOffers: [] },
  } as unknown as CatalogueIntakeCandidate;
}

async function writeIdentityArtifacts(
  repositoryRoot: string,
  candidate: CatalogueIntakeCandidate,
  source: string,
) {
  const evidence = candidate.identity.officialEvidence;
  assert.ok(evidence);
  await mkdir(path.join(repositoryRoot, 'data/catalogue-identity-evidence'), { recursive: true });
  await mkdir(path.join(repositoryRoot, 'data/catalogue-identity-source-evidence'), { recursive: true });
  await writeFile(
    path.join(repositoryRoot, evidence.snapshotPath),
    catalogueIdentityExtractionCanonicalJson(evidence.canonicalExtraction),
  );
  const extraction = evidence.canonicalExtraction;
  assert.equal(
    extraction.schemaVersion,
    catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  );
  if (extraction.schemaVersion !== catalogueManufacturerSkuIdentityExtractionSchemaVersion) return;
  await writeFile(path.join(repositoryRoot, extraction.sourceSnapshotPath), source);
}

test('manufacturer identity keys remain stable while route/package collisions stay visible', () => {
  const manufacturerKeyText = 'SKU CER-BARRIER-400-A';
  const manufacturerCrosswalk: CatalogueOfficialProductIdentityCrosswalk = {
    schemaVersion: catalogueOfficialProductCrosswalkSchemaVersion,
    canonicalManufacturerProductKey: {
      basis: 'manufacturer-sku',
      value: 'CER-BARRIER-400-A',
      manufacturerHost: 'africa.cerave.com',
      sourceLocator: 'Rendered product metadata row labelled SKU',
      sourceText: manufacturerKeyText,
      sourceTextSha256: sha256(manufacturerKeyText),
    },
    officialSourceResponseSha256: 'a'.repeat(64),
    officialProductUrl,
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    packageVersion: 'Pump bottle 400 ml',
  };
  const identifier = catalogueCanonicalIdentifierFor({
    canonicalIdentifier: {
      kind: 'manufacturer-sku',
      value: 'cer-barrier-400-a',
      label: 'SKU',
    },
    officialProductCrosswalk: manufacturerCrosswalk,
  });
  assert.deepEqual(identifier, {
    kind: 'manufacturer-sku',
    value: 'CER-BARRIER-400-A',
    label: 'SKU',
  });
  assert.equal(
    catalogueCanonicalIdentifierKey('CeraVe', identifier!),
    'manufacturer-sku:cerave:CER-BARRIER-400-A',
  );

  const routeKey = catalogueOfficialRouteManufacturerProductKey(officialProductUrl);
  assert.ok(routeKey);
  const gtinCrosswalk: CatalogueOfficialProductIdentityCrosswalk = {
    ...manufacturerCrosswalk,
    canonicalManufacturerProductKey: routeKey,
    variant: 'Example Barrier Lotion™',
  };
  assert.equal(
    catalogueOfficialProductRoutePackageKey(manufacturerCrosswalk),
    catalogueOfficialProductRoutePackageKey(gtinCrosswalk),
  );
  assert.equal(catalogueOfficialProductCrosswalkRouteClass(manufacturerCrosswalk), 'manufacturer-sku');
  assert.equal(catalogueOfficialProductCrosswalkRouteClass(gtinCrosswalk), 'official-route');
});

test('retained records bind an exact byte range and explicit catalogue brand field', () => {
  const source = `before-${productRecord}-after`;
  const record = retainedRecord(source, productRecord, 'article[data-product-record]');
  assert.equal(
    verifiedCatalogueRetainedRecord(Buffer.from(source), record)?.toString('utf8'),
    productRecord,
  );
  assert.equal(
    verifiedCatalogueRetainedRecord(
      Buffer.from(source.replace('400 ml', '401 ml')),
      record,
    ),
    undefined,
  );
  assert.equal(sourceTextNamesCatalogueBrandField('Brand CeraVe', 'CeraVe'), true);
  assert.equal(sourceTextNamesCatalogueBrandField('Vendor: CeraVe', 'CeraVe'), true);
  assert.equal(
    sourceTextNamesCatalogueBrandField(
      'CeraVe appears in this featured-products story.',
      'CeraVe',
    ),
    false,
  );
});

test('artifact verification rejects incidental brand prose and structured identifier keys', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'jelocare-manufacturer-artifacts-'),
  );
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }));

  const cleanSource = `<!doctype html><html><body>${productRecord}</body></html>`;
  const cleanCandidate = manufacturerCandidate(cleanSource);
  await writeIdentityArtifacts(repositoryRoot, cleanCandidate, cleanSource);
  assert.equal(
    await verifyCatalogueIdentityEvidenceArtifacts([cleanCandidate], repositoryRoot),
    1,
  );

  const incidentalSource = cleanSource.replace(
    '<p>Brand CeraVe</p>',
    '<p>Brand CeraVe appears in this marketing story.</p>',
  );
  const incidentalCandidate = manufacturerCandidate(incidentalSource);
  await writeIdentityArtifacts(repositoryRoot, incidentalCandidate, incidentalSource);
  await assert.rejects(
    () => verifyCatalogueIdentityEvidenceArtifacts([incidentalCandidate], repositoryRoot),
    /does not contain every claimed product field/,
  );

  for (const key of ['gtin13', 'ean13', 'upca', 'barcodeValue']) {
    const structuredSource = cleanSource.replace(
      '</body>',
      `<script>window.identifier={"${key}":"4005808319695"}</script></body>`,
    );
    const structuredCandidate = manufacturerCandidate(structuredSource);
    await writeIdentityArtifacts(repositoryRoot, structuredCandidate, structuredSource);
    await assert.rejects(
      () => verifyCatalogueIdentityEvidenceArtifacts(
        [structuredCandidate],
        repositoryRoot,
      ),
      /contradicts its no-GTIN search result/,
      `structured identifier key ${key} must be detected`,
    );
  }

  const proseSource = cleanSource.replace(
    '</body>',
    '<p>Read about barcode design, EAN history, GTIN policy and UPC standards.</p></body>',
  );
  const proseCandidate = manufacturerCandidate(proseSource);
  await writeIdentityArtifacts(repositoryRoot, proseCandidate, proseSource);
  assert.equal(
    await verifyCatalogueIdentityEvidenceArtifacts([proseCandidate], repositoryRoot),
    1,
  );
});

test('artifact verification retains an exact official JSON product response without synthetic DOM', async t => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'jelocare-manufacturer-json-artifacts-'),
  );
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }));

  const source = JSON.stringify({
    id: 123,
    title: 'Example Barrier Lotion',
    vendor: 'CeraVe',
    package_version: 'Pump bottle 400 ml',
    variants: [{
      id: 456,
      title: '400 ml',
      option1: '400 ml',
      sku: 'CER-BARRIER-400-A',
      barcode: null,
    }],
  });
  const candidate = manufacturerJsonCandidate(source);
  await writeIdentityArtifacts(repositoryRoot, candidate, source);
  assert.equal(
    await verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot),
    1,
  );

  const contradictorySource = source.replace(
    '"barcode":null',
    '"barcode":null,"gtin13":"4005808319695"',
  );
  const contradictoryCandidate = manufacturerJsonCandidate(contradictorySource);
  await writeIdentityArtifacts(
    repositoryRoot,
    contradictoryCandidate,
    contradictorySource,
  );
  await assert.rejects(
    () => verifyCatalogueIdentityEvidenceArtifacts(
      [contradictoryCandidate],
      repositoryRoot,
    ),
    /publishes another identifier/,
  );
});
