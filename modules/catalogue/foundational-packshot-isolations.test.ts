import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import intake from '@/data/foundational-packshot-intake.json';
import isolations from '@/data/foundational-packshot-isolations.json';
import productAssets from '@/data/product-assets.json';
import { products } from '@/data/products';

test('foundational source-pixel isolations bind the source, runtime, output and ordered reviews', async () => {
  const ids = new Set<string>();
  for (const isolation of isolations) {
    assert.equal(ids.has(isolation.id), false, isolation.id);
    ids.add(isolation.id);

    const candidate = intake.candidates.find(item => item.productSlug === isolation.productSlug);
    const product = products.find(item => item.slug === isolation.productSlug);
    assert.ok(candidate, isolation.productSlug);
    assert.ok(product, isolation.productSlug);
    assert.equal(isolation.source.url, candidate.asset.sourceUrl);
    assert.equal(isolation.source.sha256, candidate.asset.sourceAssetSha256);
    assert.equal(isolation.source.byteSize, candidate.asset.sourceAssetByteSize);
    assert.equal(isolation.identity.gtin, candidate.identity.gtin);
    assert.equal(isolation.identity.officialProductUrl, candidate.identity.officialProductUrl);
    assert.equal(isolation.processing.pipelineVersion, 'exact-sku-source-pixel-isolation-v3');
    assert.equal(isolation.processing.packageRgbOrigin, 'identity-master-source-pixels-only');
    assert.equal(isolation.processing.provider, 'CPUExecutionProvider');
    assert.match(isolation.processing.modelSha256, /^[0-9a-f]{64}$/);
    assert.match(isolation.processing.runtimeLockSha256, /^[0-9a-f]{64}$/);
    assert.match(isolation.audit.sha256, /^[0-9a-f]{64}$/);
    assert.equal(isolation.audit.removedComponentCount, 0);
    assert.equal(isolation.audit.removedForegroundFraction, 0);
    assert.equal(isolation.audit.componentReviewRequired, false);
    assert.ok(Date.parse(isolation.source.retrievedAt) < Date.parse(isolation.audit.generatedAt));
    assert.ok(Date.parse(isolation.audit.generatedAt) < Date.parse(isolation.review.identityReviewedAt));
    assert.ok(Date.parse(isolation.review.identityReviewedAt) < Date.parse(isolation.review.artReviewedAt));
    assert.deepEqual(isolation.review.surfaces, ['peach', 'pink', 'dark']);
    assert.equal(isolation.review.packagingIntact, true);
    assert.equal(isolation.review.labelVariantSizeUnchanged, true);
    assert.equal(isolation.review.magazineReady, true);
    assert.equal(isolation.rightsStatus, 'not-verified');
    assert.equal(isolation.publicationScope, 'legacy-foundational-display');

    const canonical = productAssets[isolation.productSlug as keyof typeof productAssets];
    assert.ok(canonical, isolation.productSlug);
    assert.equal(canonical.sourceUrl, isolation.source.url);
    assert.equal(canonical.contentHash, isolation.output.sha256);
    assert.equal('derivation' in canonical, true);
    if (!('derivation' in canonical)) throw new Error(`${isolation.productSlug}: missing derivation`);
    const derivation = canonical.derivation as typeof canonical.derivation & {
      sourceAssetSha256?: string;
      auditSha256?: string;
      isolationRecordId?: string;
    };
    assert.equal(derivation.kind, 'source-pixel-isolation');
    assert.equal(derivation.sourceAssetSha256, isolation.source.sha256);
    assert.equal(derivation.auditSha256, isolation.audit.sha256);
    assert.equal(derivation.isolationRecordId, isolation.id);

    const file = path.join(process.cwd(), 'public', isolation.output.localPath.replace(/^\//, ''));
    const bytes = await readFile(file);
    const [metadata, statistics] = await Promise.all([sharp(bytes).metadata(), sharp(bytes).stats()]);
    assert.equal(bytes.length, isolation.output.byteSize);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), isolation.output.sha256);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, isolation.output.width);
    assert.equal(metadata.height, isolation.output.height);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(statistics.isOpaque, false);
  }
});
