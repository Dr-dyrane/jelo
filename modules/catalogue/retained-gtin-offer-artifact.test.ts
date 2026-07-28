import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyCatalogueIdentityEvidenceArtifacts } from '@/lib/catalogue/identity-evidence-artifact';
import {
  catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
  type ReviewedRetainedGtinExactOfferEvidence,
} from '@/lib/catalogue/market-evidence';
import type { CatalogueIntakeCandidate } from '@/lib/catalogue/intake-readiness';

const candidateId = 'keracare-dry-itchy-scalp-conditioner-950ml';
const responseUrl = 'https://buybetter.ng/wp-json/wc/store/v1/products/1842';

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

async function sourceCandidate() {
  const manifest = JSON.parse(
    await readFile(path.join(process.cwd(), 'data/catalogue-intake.json'), 'utf8'),
  ) as { candidates: CatalogueIntakeCandidate[] };
  const candidate = manifest.candidates.find(item => item.id === candidateId);
  assert.ok(candidate);
  return structuredClone(candidate);
}

function retainedEvidence(
  candidate: CatalogueIntakeCandidate,
  source: string,
): ReviewedRetainedGtinExactOfferEvidence {
  const offer = candidate.nigeria.exactOffers[0];
  assert.ok(offer);
  assert.ok(candidate.identity.gtin);
  const parsed = JSON.parse(source) as {
    prices: Record<string, unknown>;
    stock_availability: { text: string };
  };
  return {
    schemaVersion: catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
    method: 'reviewed-exact-offer-field-extraction',
    listingUrl: offer.listingUrl,
    responseUrl,
    responseSha256: sha256(source),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'application/json',
    responseByteSize: Buffer.byteLength(source),
    retrievedAt: offer.observedAt,
    responseSnapshotPath:
      `data/catalogue-offer-source-evidence/${candidateId}--buybetter.json`,
    offerRecord: {
      locator: 'Complete exact Woo Store API product response',
      byteStart: 0,
      byteEnd: Buffer.byteLength(source),
      sourceText: source,
      sourceFragmentSha256: sha256(source),
    },
    fields: {
      gtin: {
        label: 'GTIN',
        value: candidate.identity.gtin,
        locator: 'Reviewed official catalogue identity',
        sourceText: `Official catalogue identity GTIN ${candidate.identity.gtin}`,
        responseRole: 'official-identity-correlation',
      },
      title: {
        value: offer.observedTitle,
        locator: 'Woo product name',
        sourceText: offer.observedTitle,
      },
      size: {
        value: offer.observedSize,
        locator: 'Measured size in Woo product name',
        sourceText: offer.observedTitle,
      },
      price: {
        value: offer.priceNgn,
        currency: 'NGN',
        locator: 'Woo prices object',
        sourceText: JSON.stringify(parsed.prices),
      },
      stock: {
        value: offer.stock,
        locator: 'Woo stock availability text',
        sourceText: parsed.stock_availability.text,
      },
    },
    reviewer: 'JeloCare catalogue evidence review',
    reviewedAt: new Date(Date.parse(offer.observedAt) + 60_000).toISOString(),
  };
}

function exactWooSource(
  candidate: CatalogueIntakeCandidate,
  overrides: Record<string, unknown> = {},
) {
  const offer = candidate.nigeria.exactOffers[0];
  assert.ok(offer);
  return JSON.stringify({
    id: 1842,
    name: offer.observedTitle,
    permalink: offer.listingUrl,
    sku: offer.retailerSku,
    prices: {
      price: String(offer.priceNgn * 100),
      currency_code: 'NGN',
      currency_minor_unit: 2,
    },
    stock_availability: {
      text: offer.stock === 'in-stock' ? 'In stock' : 'Out of stock',
      class: offer.stock,
    },
    is_in_stock: offer.stock !== 'out-of-stock',
    ...overrides,
  });
}

async function writeFixture(
  repositoryRoot: string,
  candidate: CatalogueIntakeCandidate,
  source: string,
) {
  const identityEvidence = candidate.identity.officialEvidence;
  assert.ok(identityEvidence);
  await Promise.all([
    mkdir(path.join(repositoryRoot, 'data/catalogue-identity-evidence'), { recursive: true }),
    mkdir(path.join(repositoryRoot, 'data/catalogue-offer-source-evidence'), { recursive: true }),
  ]);
  await writeFile(
    path.join(repositoryRoot, identityEvidence.snapshotPath),
    await readFile(path.join(process.cwd(), identityEvidence.snapshotPath)),
  );
  const offer = candidate.nigeria.exactOffers[0];
  assert.ok(offer);
  offer.evidence = retainedEvidence(candidate, source);
  await writeFile(
    path.join(
      repositoryRoot,
      `data/catalogue-offer-source-evidence/${candidateId}--buybetter.json`,
    ),
    source,
  );
}

test('reopens a schema-4 GTIN offer and binds one exact Woo record to its listing', async t => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'jelocare-retained-gtin-'));
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }));
  const candidate = await sourceCandidate();
  const source = exactWooSource(candidate);
  await writeFixture(repositoryRoot, candidate, source);

  assert.equal(
    await verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot),
    1,
  );

  await writeFile(
    path.join(
      repositoryRoot,
      `data/catalogue-offer-source-evidence/${candidateId}--buybetter.json`,
    ),
    source.replace('In stock', 'Out of stock'),
  );
  await assert.rejects(
    () => verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot),
    /response bytes changed/,
  );
});

test('rejects a foreign listing record and a symlinked retained response', async t => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'jelocare-retained-gtin-'));
  t.after(() => rm(repositoryRoot, { recursive: true, force: true }));
  const candidate = await sourceCandidate();
  const foreign = exactWooSource(candidate, {
    permalink: 'https://buybetter.ng/product/a-different-product/',
  });
  await writeFixture(repositoryRoot, candidate, foreign);
  await assert.rejects(
    () => verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot),
    /does not bind its API record to the listing/,
  );

  const source = exactWooSource(candidate);
  await writeFixture(repositoryRoot, candidate, source);
  const retainedPath = path.join(
    repositoryRoot,
    `data/catalogue-offer-source-evidence/${candidateId}--buybetter.json`,
  );
  const targetPath = path.join(repositoryRoot, 'retained-target.json');
  await rm(retainedPath);
  await writeFile(targetPath, source);
  await symlink(targetPath, retainedPath);
  await assert.rejects(
    () => verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot),
    /not a regular checked-in evidence file/,
  );
});
