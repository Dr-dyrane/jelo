import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import promotions from '@/data/product-asset-promotions.json';
import repairs from '@/data/product-asset-repairs.json';
import { expandedProducts } from '@/data/expanded-products';
import { products as coreProducts } from '@/data/products';
import {
  analysePackshotSilhouette,
  likelySlicedPackshotBase,
  likelyTruncatedPackshot,
} from '@/lib/assets/packshot-silhouette';
import {
  assertStagedProductAssetPromotion,
  expectedSharpFormatForStagedProductAsset,
  promoteVerifiedStagedProductAsset,
  resolveStagedProductAssetPath,
  type CatalogueIntakeAssetPromotion,
  type StagedProductAssetBlobClient,
  type StagedProductAssetPromotion,
  verifyCatalogueIntakePromotionBinding,
} from '@/lib/assets/staged-product-asset-promotion';
import { parseStagedProductPromotionIds } from '@/lib/assets/staged-product-promotion-selection';

test('staged promotions bind exact local bytes to one public product or private candidate', async () => {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const candidateIds = new Set<string>();
  const productBySlug = new Map([...coreProducts, ...expandedProducts].map(product => [product.slug, product]));
  const repairIds = new Set(repairs.repairs.map(repair => repair.id));

  for (const promotion of promotions as StagedProductAssetPromotion[]) {
    assert.equal(ids.has(promotion.id), false, promotion.id);
    ids.add(promotion.id);

    const target = assertStagedProductAssetPromotion(promotion);
    if (target.kind === 'public-product') {
      assert.equal(slugs.has(target.id), false, target.id);
      slugs.add(target.id);
      const product = productBySlug.get(target.id);
      assert.ok(product, target.id);
      assert.equal(product.image, promotion.sourceUrl);
    } else {
      assert.equal(candidateIds.has(target.id), false, target.id);
      candidateIds.add(target.id);
      assert.equal(
        productBySlug.has(target.id),
        false,
        `${target.id}: private candidate is already present in the public catalogue`,
      );
      await verifyCatalogueIntakePromotionBinding(
        promotion as CatalogueIntakeAssetPromotion,
      );
    }

    const localFile = resolveStagedProductAssetPath(promotion);

    // Once a promotion has been uploaded to the Vercel Blob store by a
    // production deploy, the local PNG is removed from git to avoid bloat.
    // Skip byte-level verification for those already-promoted assets — the
    // blob URL is the canonical source and the hash is recorded in the
    // promotion record.
    let localFileExists = true;
    try {
      await access(localFile);
    } catch {
      localFileExists = false;
    }
    if (!localFileExists) continue;

    const bytes = await readFile(localFile);
    const [metadata, statistics, silhouette] = await Promise.all([
      sharp(bytes).metadata(),
      sharp(bytes).stats(),
      analysePackshotSilhouette(bytes),
    ]);
    assert.equal(bytes.length, promotion.byteSize);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), promotion.contentHash);
    assert.equal(metadata.width, promotion.width);
    assert.equal(metadata.height, promotion.height);
    assert.equal(metadata.hasAlpha, promotion.hasAlpha);
    assert.equal(metadata.format, expectedSharpFormatForStagedProductAsset(promotion.contentType));
    if (promotion.hasAlpha) {
      assert.equal(statistics.isOpaque, false);
      assert.equal(
        likelyTruncatedPackshot(silhouette),
        false,
        `${promotion.id}: staged packshot has an inherited lower crop`,
      );
      if (repairIds.has(promotion.id)) {
        assert.equal(
          likelySlicedPackshotBase(silhouette),
          false,
          `${promotion.id}: generated repair still has a sliced lower seam`,
        );
      }
    }
  }
});

function candidatePromotion(bytes: Buffer): CatalogueIntakeAssetPromotion {
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const candidateId = 'private-candidate-test';
  const blobPath = `catalogue-intake/${candidateId}/packshot-v1-${contentHash.slice(0, 12)}.png`;
  return {
    id: `${candidateId}-v1`,
    active: true,
    candidateId,
    destination: 'private-staging',
    sourceUrl: 'https://example.com/exact-source.png',
    localPath: `data/catalogue-intake-assets/${candidateId}/packshot-v1.png`,
    blobPath,
    blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/${blobPath}`,
    contentType: 'image/png',
    byteSize: bytes.length,
    width: 1,
    height: 1,
    hasAlpha: true,
    contentHash,
  };
}

function remoteRead(
  promotion: StagedProductAssetPromotion,
  bytes: Buffer,
  overrides: Partial<{
    url: string;
    pathname: string;
    contentType: string;
    size: number;
  }> = {},
) {
  return {
    statusCode: 200 as const,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    blob: {
      url: overrides.url ?? promotion.blobUrl,
      pathname: overrides.pathname ?? promotion.blobPath,
      contentType: overrides.contentType ?? promotion.contentType,
      size: overrides.size ?? promotion.byteSize,
    },
  };
}

test('private candidate paths are non-public, versioned, and content-addressed', () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  assert.deepEqual(assertStagedProductAssetPromotion(promotion), {
    kind: 'catalogue-intake',
    id: 'private-candidate-test',
  });
  assert.match(
    resolveStagedProductAssetPath(promotion, '/repository'),
    /\/repository\/data\/catalogue-intake-assets\/private-candidate-test\/packshot-v1\.png$/,
  );

  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...promotion,
      localPath: '/products/private-candidate-test/packshot-v1.png',
    }),
    /must stay outside public/,
  );
  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...promotion,
      blobPath: 'catalogue-intake/private-candidate-test/packshot-v1-deadbeefdead.png',
      blobUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/catalogue-intake/private-candidate-test/packshot-v1-deadbeefdead.png',
    }),
    /matching hash prefix/,
  );
  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...promotion,
      productSlug: 'private-candidate-test',
    } as unknown as StagedProductAssetPromotion),
    /exactly one productSlug or candidateId/,
  );
});

test('asset promotion URLs and public paths are structurally bound to their target', () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  assert.throws(
    () => assertStagedProductAssetPromotion({ ...promotion, sourceUrl: 'not a URL' }),
    /private-candidate-test-v1: source URL is invalid/,
  );
  assert.throws(
    () => assertStagedProductAssetPromotion({ ...promotion, blobUrl: 'not a URL' }),
    /private-candidate-test-v1: destination URL is invalid/,
  );

  const publicPromotion = {
    ...promotion,
    id: 'example-product-v1',
    candidateId: undefined,
    productSlug: 'example-product',
    localPath: '/products/example/example-product-transparent-v1.png',
    blobPath: 'products/example/example-product/packshot-v1.png',
    blobUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/example-product/packshot-v1.png',
  } as unknown as StagedProductAssetPromotion;
  assert.deepEqual(assertStagedProductAssetPromotion(publicPromotion), {
    kind: 'public-product',
    id: 'example-product',
  });
  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...publicPromotion,
      blobPath: 'products/example/other-example-product/packshot-v1.png',
      blobUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/other-example-product/packshot-v1.png',
    }),
    /Blob path does not match productSlug/,
  );
});

test('asset promotion selection never silently widens malformed input', () => {
  assert.deepEqual(parseStagedProductPromotionIds([]), []);
  assert.deepEqual(parseStagedProductPromotionIds(['--id=example-product-v1']), ['example-product-v1']);
  assert.throws(() => parseStagedProductPromotionIds(['--id=']), /Invalid staged asset promotion ID/);
  assert.throws(() => parseStagedProductPromotionIds(['--id']), /Unknown staged asset promotion argument/);
  assert.throws(() => parseStagedProductPromotionIds(['--unexpected']), /Unknown staged asset promotion argument/);
  assert.throws(
    () => parseStagedProductPromotionIds(['--id=example-product-v1', '--id=example-product-v1']),
    /must be unique/,
  );
});

test('AVIF promotion metadata uses sharp’s HEIF decoded format', () => {
  assert.equal(expectedSharpFormatForStagedProductAsset('image/avif'), 'heif');
});

test('publication candidate paths stay private locally and bind brand, SKU and hash remotely', () => {
  const bytes = Buffer.from('reviewed publication bytes');
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const candidateId = 'private-candidate-test';
  const blobPath = `products/example/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`;
  const promotion: CatalogueIntakeAssetPromotion = {
    ...candidatePromotion(bytes),
    destination: 'publication',
    publicationBrandSlug: 'example',
    blobPath,
    blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/${blobPath}`,
  };

  assert.deepEqual(assertStagedProductAssetPromotion(promotion), {
    kind: 'catalogue-publication',
    id: candidateId,
    brandSlug: 'example',
  });
  assert.match(
    resolveStagedProductAssetPath(promotion, '/repository'),
    /\/repository\/data\/catalogue-intake-assets\/private-candidate-test\/packshot-v1\.png$/,
  );
  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...promotion,
      blobPath: `products/other/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
      blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/other/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
    }),
    /must bind the brand, candidate, version and content hash/,
  );
  assert.throws(
    () => assertStagedProductAssetPromotion({
      ...promotion,
      blobPath: `products/example/${candidateId}/packshot-v1-deadbeefdeadbeef.png`,
      blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/${candidateId}/packshot-v1-deadbeefdeadbeef.png`,
    }),
    /must bind the brand, candidate, version and content hash/,
  );
});

test('candidate promotions bind to the private intake source asset', async () => {
  const candidateId = 'nivea-perfect-radiant-body-lotion-400ml';
  const sourcePath = path.join(
    process.cwd(),
    'data/catalogue-intake-candidates',
    `${candidateId}.json`,
  );
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as {
    candidate: { asset: { sourceUrl: string } };
  };
  const bytes = Buffer.from('binding-only fixture');
  const promotion = {
    ...candidatePromotion(bytes),
    id: `${candidateId}-v1`,
    candidateId,
    sourceUrl: source.candidate.asset.sourceUrl,
    localPath: `data/catalogue-intake-assets/${candidateId}/packshot-v1.png`,
  };
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  promotion.blobPath = `catalogue-intake/${candidateId}/packshot-v1-${contentHash.slice(0, 12)}.png`;
  promotion.blobUrl = `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/${promotion.blobPath}`;

  await verifyCatalogueIntakePromotionBinding(promotion);
  await assert.rejects(
    verifyCatalogueIntakePromotionBinding({
      ...promotion,
      sourceUrl: 'https://example.com/wrong-source.png',
    }),
    /source-asset binding is invalid/,
  );

  const publication = {
    ...promotion,
    destination: 'publication' as const,
    publicationBrandSlug: 'nivea',
    blobPath: `products/nivea/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
    blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/nivea/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
  };
  await verifyCatalogueIntakePromotionBinding(publication);
  await assert.rejects(
    verifyCatalogueIntakePromotionBinding({
      ...publication,
      publicationBrandSlug: 'wrong-brand',
      blobPath: `products/wrong-brand/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
      blobUrl: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/wrong-brand/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
    }),
    /publication brand binding is invalid/,
  );
});

test('an exact existing remote asset is verified and skipped without writing', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  let putCalls = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => remoteRead(promotion, bytes, {
      url: promotion.blobUrl.replace(
        'm6aftkbqbwtkxooa.public',
        'M6aftkBQBWTKxOoA.public',
      ),
    }),
    put: async () => {
      putCalls += 1;
      throw new Error('put must not run');
    },
  };

  assert.equal(
    await promoteVerifiedStagedProductAsset(promotion, bytes, client),
    'verified-existing',
  );
  assert.equal(putCalls, 0);
});

test('a new asset uses create-only upload options and is remotely verified', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  let getCalls = 0;
  let putCalls = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => {
      getCalls += 1;
      return getCalls === 1 ? null : remoteRead(promotion, bytes);
    },
    put: async (pathname, body, options) => {
      putCalls += 1;
      assert.equal(pathname, promotion.blobPath);
      assert.deepEqual(body, bytes);
      assert.deepEqual(options, {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 31_536_000,
      });
      return {
        url: promotion.blobUrl,
        pathname: promotion.blobPath,
        contentType: promotion.contentType,
      };
    },
  };

  assert.equal(
    await promoteVerifiedStagedProductAsset(promotion, bytes, client),
    'uploaded',
  );
  assert.equal(putCalls, 1);
  assert.equal(getCalls, 2);
});

test('a new asset tolerates bounded post-write visibility delay before verification', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  let getCalls = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => {
      getCalls += 1;
      return getCalls < 4 ? null : remoteRead(promotion, bytes);
    },
    put: async () => ({
      url: promotion.blobUrl,
      pathname: promotion.blobPath,
      contentType: promotion.contentType,
    }),
  };

  assert.equal(
    await promoteVerifiedStagedProductAsset(promotion, bytes, client, {
      postWriteVerificationDelaysMs: [0, 0, 0],
    }),
    'uploaded',
  );
  assert.equal(getCalls, 4);
});

test('remote metadata or byte mismatches fail closed and never overwrite', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  let putCalls = 0;
  const metadataMismatch: StagedProductAssetBlobClient = {
    get: async () => remoteRead(promotion, bytes, { contentType: 'image/jpeg' }),
    put: async () => {
      putCalls += 1;
      throw new Error('put must not run');
    },
  };
  await assert.rejects(
    promoteVerifiedStagedProductAsset(promotion, bytes, metadataMismatch),
    /remote Blob metadata does not match/,
  );

  const altered = Buffer.from(bytes);
  altered[0] ^= 0xff;
  const byteMismatch: StagedProductAssetBlobClient = {
    get: async () => remoteRead(promotion, altered),
    put: async () => {
      putCalls += 1;
      throw new Error('put must not run');
    },
  };
  await assert.rejects(
    promoteVerifiedStagedProductAsset(promotion, bytes, byteMismatch),
    /remote Blob bytes do not match/,
  );
  assert.equal(putCalls, 0);
});

test('local promotion bytes are checked before a remote read or write', async () => {
  const reviewedBytes = Buffer.from('reviewed candidate bytes');
  const alteredBytes = Buffer.from('altered candidate bytes');
  const promotion = candidatePromotion(reviewedBytes);
  let reads = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => {
      reads += 1;
      return null;
    },
    put: async () => {
      throw new Error('put must not run');
    },
  };
  await assert.rejects(
    promoteVerifiedStagedProductAsset(promotion, alteredBytes, client),
    /local staged bytes do not match the reviewed asset/,
  );
  assert.equal(reads, 0);
});

test('a concurrent create is idempotent only when the winning bytes verify', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const promotion = candidatePromotion(bytes);
  let getCalls = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => {
      getCalls += 1;
      return getCalls === 1 ? null : remoteRead(promotion, bytes);
    },
    put: async () => {
      throw new Error('another build created the immutable path');
    },
  };

  assert.equal(
    await promoteVerifiedStagedProductAsset(promotion, bytes, client),
    'verified-existing',
  );
  assert.equal(getCalls, 2);
});

test('a concurrent create with different winning bytes fails closed', async () => {
  const bytes = Buffer.from('reviewed candidate bytes');
  const altered = Buffer.from(bytes);
  altered[0] ^= 0xff;
  const promotion = candidatePromotion(bytes);
  let getCalls = 0;
  const client: StagedProductAssetBlobClient = {
    get: async () => {
      getCalls += 1;
      return getCalls === 1 ? null : remoteRead(promotion, altered);
    },
    put: async () => {
      throw new Error('another build created the immutable path');
    },
  };
  await assert.rejects(
    promoteVerifiedStagedProductAsset(promotion, bytes, client, { postWriteVerificationDelaysMs: [0] }),
    /remote Blob bytes do not match/,
  );
  assert.equal(getCalls, 2);
});
