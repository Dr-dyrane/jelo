import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { products } from '@/data/catalogue';
import editorialAssets from '@/data/editorial-assets.json';
import productAssets from '@/data/product-assets.json';
import { withheldProductAssets } from '@/data/withheld-product-assets';

const assetHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com';
const allowedTypes = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);

test('every product resolves to a canonical Blob or an explicit rights-based hold', () => {
  const manifest = productAssets as Record<string, {
    sourceUrl: string;
    blobUrl: string;
    contentType: string;
    byteSize: number;
    width: number;
    height: number;
    hasAlpha: boolean;
    contentHash: string;
  }>;

  assert.deepEqual(
    [...Object.keys(manifest), ...Object.keys(withheldProductAssets)].sort(),
    products.map(product => product.slug).sort(),
  );
  for (const product of products) {
    const asset = manifest[product.slug];
    const withheld = withheldProductAssets[product.slug as keyof typeof withheldProductAssets];
    if (withheld) {
      assert.equal(asset, undefined);
      assert.equal(product.image, withheld.fallbackUrl);
      assert.equal(withheld.reason, 'source-terms-prohibit-reuse');
      assert.equal(new URL(withheld.policyUrl).protocol, 'https:');
      assert.ok(!Number.isNaN(Date.parse(withheld.reviewedAt)));
      continue;
    }
    assert.ok(asset);
    const url = new URL(asset.blobUrl);
    assert.equal(url.hostname, assetHost);
    assert.match(url.pathname, new RegExp(`/products/[^/]+/${product.slug}/packshot\\.(?:avif|jpg|png|webp)$`));
    assert.equal(product.image, asset.blobUrl);
    assert.equal(new URL(asset.sourceUrl).protocol, 'https:');
    assert.ok(allowedTypes.has(asset.contentType));
    assert.ok(asset.byteSize > 0);
    assert.ok(asset.width > 0 && asset.height > 0);
    assert.equal(typeof asset.hasAlpha, 'boolean');
    assert.match(asset.contentHash, /^[0-9a-f]{64}$/);
  }
});

test('generated editorial cutouts have real transparent pixels and durable records', async () => {
  const cutouts = editorialAssets.filter(asset => asset.transparent);
  assert.ok(cutouts.length >= 5);

  for (const asset of editorialAssets) {
    const url = new URL(asset.blobUrl);
    assert.equal(url.hostname, assetHost);
    const file = path.join(process.cwd(), 'public', asset.localPath.replace(/^\//, ''));
    const [fileStat, metadata, statistics] = await Promise.all([
      stat(file),
      sharp(file).metadata(),
      sharp(file).stats(),
    ]);
    assert.equal(fileStat.size, asset.byteSize);
    assert.equal(metadata.width, asset.width);
    assert.equal(metadata.height, asset.height);
    if (asset.transparent) {
      assert.equal(asset.mimeType, 'image/png');
      assert.equal(metadata.hasAlpha, true);
      assert.equal(statistics.isOpaque, false);
    }
  }
});
