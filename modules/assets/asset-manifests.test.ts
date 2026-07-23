import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { products } from '@/data/catalogue';
import { expandedProducts } from '@/data/expanded-products';
import editorialAssets from '@/data/editorial-assets.json';
import publicationDossiers from '@/data/catalogue-publication-dossiers.json';
import { isProductDisplayApproved, productDisplayApprovals } from '@/data/product-display-approvals';
import productAssets from '@/data/product-assets.json';
import { products as coreProducts } from '@/data/products';
import { publishedIntakeProducts } from '@/data/published-intake-products';
import { withheldProductAssets } from '@/data/withheld-product-assets';

const assetHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com';
const allowedTypes = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);

test('only transparent canonical packshots enter public product surfaces', () => {
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

  const sourceProducts = [...coreProducts, ...expandedProducts];
  const sourceBySlug = new Map(sourceProducts.map(product => [product.slug, product]));
  assert.deepEqual([...Object.keys(manifest), ...Object.keys(withheldProductAssets)].sort(), sourceProducts.map(product => product.slug).sort());

  const publicSlugs = new Set(products.map(product => product.slug));
  const approvedSlugs = new Set(Object.keys(productDisplayApprovals));
  for (const slug of Object.keys(withheldProductAssets)) assert.equal(publicSlugs.has(slug), false);
  for (const [slug, asset] of Object.entries(manifest)) {
    const product = sourceBySlug.get(slug);
    const displayReady = asset.hasAlpha
      && Math.min(asset.width, asset.height) >= 1000
      && Boolean(product && isProductDisplayApproved(product, asset));
    assert.equal(publicSlugs.has(slug), displayReady, slug);
  }

  const releasedSlugs = new Set(publishedIntakeProducts.map(product => product.slug));
  assert.deepEqual([...publicSlugs].sort(), [...approvedSlugs, ...releasedSlugs].sort());
  for (const [slug, approval] of Object.entries(productDisplayApprovals)) {
    const product = sourceBySlug.get(slug);
    assert.ok(product, slug);
    assert.equal(manifest[slug]?.contentHash, approval.artReview.contentHash, slug);
    assert.equal(manifest[slug]?.sourceUrl, approval.identityReview.sourceUrl, slug);
    assert.equal(product.brand, approval.identityReview.brand, slug);
    assert.equal(product.name, approval.identityReview.name, slug);
    assert.equal(product.size, approval.identityReview.size, slug);
    assert.equal(approval.identityReview.reviewer, 'Codex source audit');
    assert.equal(approval.artReview.reviewer, 'Codex visual audit');
    assert.deepEqual(approval.artReview.surfaces, ['peach', 'pink', 'dark']);
    assert.equal(approval.rightsStatus, 'not-verified');
    assert.ok(!Number.isNaN(Date.parse(approval.identityReview.reviewedAt)));
    assert.ok(!Number.isNaN(Date.parse(approval.artReview.reviewedAt)));
  }

  for (const product of products) {
    const asset = manifest[product.slug];
    const releasedDossier = publicationDossiers.dossiers.find(dossier => dossier.candidateId === product.slug);
    assert.ok(asset || releasedDossier, product.slug);
    const imageUrl = asset?.blobUrl ?? releasedDossier!.finalImage.url;
    const url = new URL(imageUrl);
    assert.equal(url.hostname, assetHost);
    assert.equal(product.image, imageUrl);
    if (asset) {
      assert.match(url.pathname, new RegExp(`/products/[^/]+/${product.slug}/packshot(?:-v\\d+)?\\.(?:avif|jpg|png|webp)$`));
      assert.equal(new URL(asset.sourceUrl).protocol, 'https:');
      assert.ok(allowedTypes.has(asset.contentType));
      assert.ok(asset.byteSize > 0);
      assert.ok(asset.width > 0 && asset.height > 0);
      assert.equal(asset.hasAlpha, true);
      assert.ok(Math.min(asset.width, asset.height) >= 1000);
      assert.match(asset.contentHash, /^[0-9a-f]{64}$/);
    } else {
      assert.match(url.pathname, new RegExp(`/products/[^/]+/${product.slug}/packshot-v\\d+-[0-9a-f]{16}\\.(?:png|webp)$`));
      assert.ok(allowedTypes.has(releasedDossier!.finalImage.mimeType));
      assert.ok(releasedDossier!.finalImage.byteSize > 0);
      assert.ok(Math.min(releasedDossier!.finalImage.width, releasedDossier!.finalImage.height) >= 1600);
      assert.match(releasedDossier!.finalImage.sha256, /^[0-9a-f]{64}$/);
    }
  }

  for (const withheld of Object.values(withheldProductAssets)) {
    assert.equal(withheld.reason, 'source-terms-prohibit-reuse');
    assert.equal(new URL(withheld.policyUrl).protocol, 'https:');
    assert.ok(!Number.isNaN(Date.parse(withheld.reviewedAt)));
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

test('the runtime product fallback has a transparent canvas', async () => {
  const file = path.join(process.cwd(), 'public', 'product-placeholder.svg');
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * 4 + 3],
    data[((info.height - 1) * info.width) * 4 + 3],
    data[((info.height * info.width) - 1) * 4 + 3],
  ];
  assert.deepEqual(cornerAlpha, [0, 0, 0, 0]);
});
