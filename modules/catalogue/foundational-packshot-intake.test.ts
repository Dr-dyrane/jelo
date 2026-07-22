import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '@/data/foundational-packshot-intake.json';
import { products } from '@/data/products';

function validGtin(value: string) {
  if (!/^\d{8,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const total = digits.reverse().reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0);
  return check === (10 - (total % 10)) % 10;
}

test('foundational packshot intake binds an exact reviewed product to official source bytes', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.candidates.length, 1);

  const ids = new Set<string>();
  for (const candidate of manifest.candidates) {
    assert.equal(ids.has(candidate.id), false, candidate.id);
    ids.add(candidate.id);

    const product = products.find(item => item.slug === candidate.productSlug);
    assert.ok(product, candidate.productSlug);
    assert.equal(candidate.id, product.slug);
    assert.equal(candidate.brand, product.brand);
    assert.equal(candidate.name, product.name);
    assert.equal(candidate.size, product.size);
    assert.equal(candidate.asset.sourceUrl, product.image);
    assert.equal(candidate.identity.officialFrontImageUrl, candidate.asset.sourceUrl);
    assert.equal(validGtin(candidate.identity.gtin), true);
    assert.equal(new URL(candidate.identity.officialProductUrl).hostname, 'www.ogxbeauty.com');
    assert.equal(new URL(candidate.identity.officialFrontImageUrl).hostname, 'images.ctfassets.net');
    assert.equal(new URL(candidate.identity.officialBackImageUrl).hostname, 'images.ctfassets.net');
    assert.match(candidate.identity.officialBackImageSha256, /^[0-9a-f]{64}$/);
    assert.match(candidate.asset.sourceAssetSha256, /^[0-9a-f]{64}$/);
    assert.equal(candidate.asset.sourceAssetMimeType, 'image/webp');
    assert.equal(candidate.asset.sourceAssetWidth, 1080);
    assert.equal(candidate.asset.sourceAssetHeight, 1080);
  }
});
