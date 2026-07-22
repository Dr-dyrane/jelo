import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import promotions from '@/data/product-asset-promotions.json';
import { products as coreProducts } from '@/data/products';

test('staged product promotions are exact local bytes bound to one reviewed product', async () => {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const productBySlug = new Map(coreProducts.map(product => [product.slug, product]));

  for (const promotion of promotions) {
    assert.equal(ids.has(promotion.id), false, promotion.id);
    assert.equal(slugs.has(promotion.productSlug), false, promotion.productSlug);
    ids.add(promotion.id);
    slugs.add(promotion.productSlug);

    const product = productBySlug.get(promotion.productSlug);
    assert.ok(product, promotion.productSlug);
    assert.equal(product.image, promotion.sourceUrl);
    assert.equal(new URL(promotion.sourceUrl).protocol, 'https:');
    const destination = new URL(promotion.blobUrl);
    assert.equal(destination.hostname, 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com');
    assert.equal(destination.pathname, `/${promotion.blobPath}`);
    assert.match(promotion.localPath, /^\/products\/[a-z0-9/-]+\.png$/);
    assert.match(promotion.contentHash, /^[0-9a-f]{64}$/);

    const localFile = path.join(process.cwd(), 'public', promotion.localPath.replace(/^\//, ''));
    const bytes = await readFile(localFile);
    const [metadata, statistics] = await Promise.all([sharp(bytes).metadata(), sharp(bytes).stats()]);
    assert.equal(bytes.length, promotion.byteSize);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), promotion.contentHash);
    assert.equal(metadata.width, promotion.width);
    assert.equal(metadata.height, promotion.height);
    assert.equal(metadata.hasAlpha, promotion.hasAlpha);
    assert.equal(statistics.isOpaque, false);
  }
});
