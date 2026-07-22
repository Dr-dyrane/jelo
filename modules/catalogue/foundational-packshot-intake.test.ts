import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '@/data/foundational-packshot-intake.json';
import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';

const reviewedProducts = [...coreProducts, ...expandedProducts];

function validGtin(value: string) {
  if (!/^\d{8,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const total = digits.reverse().reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0);
  return check === (10 - (total % 10)) % 10;
}

test('foundational packshot intake binds an exact reviewed product to official source bytes', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.candidates.length >= 3);

  const ids = new Set<string>();
  for (const candidate of manifest.candidates) {
    assert.equal(ids.has(candidate.id), false, candidate.id);
    ids.add(candidate.id);

    const product = reviewedProducts.find(item => item.slug === candidate.productSlug);
    assert.ok(product, candidate.productSlug);
    assert.equal(candidate.id, product.slug);
    assert.equal(candidate.brand, product.brand);
    assert.equal(candidate.name, product.name);
    assert.equal(candidate.size, product.size);
    assert.equal(candidate.asset.sourceUrl, product.image);
    assert.equal(candidate.identity.officialFrontImageUrl, candidate.asset.sourceUrl);
    assert.equal(validGtin(candidate.identity.gtin), true);
    assert.equal(new URL(candidate.identity.officialProductUrl).protocol, 'https:');
    assert.equal(new URL(candidate.identity.officialFrontImageUrl).protocol, 'https:');
    const officialIdentifierUrl = 'officialIdentifierUrl' in candidate.identity
      ? candidate.identity.officialIdentifierUrl
      : undefined;
    if (typeof officialIdentifierUrl === 'string') {
      assert.equal(new URL(officialIdentifierUrl).protocol, 'https:');
    }
    const officialBackImageUrl = 'officialBackImageUrl' in candidate.identity
      ? candidate.identity.officialBackImageUrl
      : undefined;
    const officialBackImageSha256 = 'officialBackImageSha256' in candidate.identity
      ? candidate.identity.officialBackImageSha256
      : undefined;
    if (typeof officialBackImageUrl === 'string' && typeof officialBackImageSha256 === 'string') {
      assert.equal(new URL(officialBackImageUrl).protocol, 'https:');
      assert.match(officialBackImageSha256, /^[0-9a-f]{64}$/);
    }
    assert.match(candidate.asset.sourceAssetSha256, /^[0-9a-f]{64}$/);
    assert.match(candidate.asset.sourceAssetMimeType, /^image\/(?:jpeg|png|webp)$/);
    assert.ok(Math.min(candidate.asset.sourceAssetWidth, candidate.asset.sourceAssetHeight) >= 800);
    assert.ok(candidate.asset.sourceAssetByteSize > 0);
  }
});
