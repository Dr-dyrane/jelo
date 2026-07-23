import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import repairs from '@/data/product-asset-repairs.json';
import productAssets from '@/data/product-assets.json';
import { productDisplayApprovals } from '@/data/product-display-approvals';
import { analysePackshotSilhouette, likelyTruncatedPackshot } from '@/lib/assets/packshot-silhouette';

test('generated packshot repairs bind identity, defective input, exact output and visual review', async () => {
  assert.equal(repairs.schemaVersion, 1);
  assert.ok(repairs.repairs.length > 0);

  for (const repair of repairs.repairs) {
    const asset = productAssets[repair.productSlug as keyof typeof productAssets];
    const approval = productDisplayApprovals[repair.productSlug as keyof typeof productDisplayApprovals];
    assert.ok(asset, repair.id);
    assert.ok(approval, repair.id);
    assert.ok('derivation' in asset, repair.id);
    const derivation = asset.derivation as typeof asset.derivation & {
      sourceAssetSha256?: string;
      repairRecordId?: string;
      fullSilhouetteVisible?: boolean;
    };
    assert.match(derivation.sourceAssetSha256 ?? '', /^[a-f0-9]{64}$/);
    assert.match(repair.identity.gtin, /^\d{8,14}$/);
    assert.equal(new URL(repair.identity.officialProductUrl).protocol, 'https:');
    assert.equal(repair.inputs.some(input => input.sha256 === derivation.sourceAssetSha256), true);
    assert.equal(repair.review.sourceDefectConfirmed, true);
    assert.equal(repair.review.fullSilhouetteVisible, true);
    assert.equal(repair.review.packagingIntact, true);
    assert.equal(repair.review.labelVariantSizeUnchanged, true);
    assert.equal(repair.review.backgroundTransparent, true);
    assert.deepEqual(repair.review.surfaces, ['peach', 'pink', 'dark']);

    const finalPath = path.join(process.cwd(), 'public', repair.output.localPath.replace(/^\//, ''));
    const finalBytes = await readFile(finalPath);
    const [metadata, statistics, silhouette] = await Promise.all([
      sharp(finalBytes).metadata(),
      sharp(finalBytes).stats(),
      analysePackshotSilhouette(finalBytes),
    ]);
    assert.equal(finalBytes.length, repair.output.byteSize);
    assert.equal(createHash('sha256').update(finalBytes).digest('hex'), repair.output.sha256);
    assert.equal(metadata.width, repair.output.width);
    assert.equal(metadata.height, repair.output.height);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(statistics.isOpaque, false);
    assert.equal(likelyTruncatedPackshot(silhouette), false);
    assert.equal(asset.contentHash, repair.output.sha256);
    assert.equal(asset.blobUrl, repair.output.blobUrl);
    assert.equal(derivation.repairRecordId, repair.id);
    assert.equal(derivation.fullSilhouetteVisible, true);
    assert.equal(approval.artReview.contentHash, repair.output.sha256);

    const clippedInput = repair.inputs.find(input => input.role === 'clipped-transparent-packshot');
    assert.ok(clippedInput && 'localPath' in clippedInput && clippedInput.localPath);
    if (!clippedInput || !('localPath' in clippedInput) || !clippedInput.localPath) {
      throw new Error(`${repair.id}: missing clipped input path`);
    }
    const clippedBytes = await readFile(path.join(process.cwd(), 'public', clippedInput.localPath.replace(/^\//, '')));
    assert.equal(createHash('sha256').update(clippedBytes).digest('hex'), clippedInput.sha256);
    assert.equal(likelyTruncatedPackshot(await analysePackshotSilhouette(clippedBytes)), true);
  }
});
