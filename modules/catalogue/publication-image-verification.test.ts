import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { cataloguePublicationSurfaces } from '@/lib/catalogue/publication-image-policy';
import {
  verifyCataloguePublicationImageBytes,
  verifyRemoteCataloguePublicationImage,
  type CataloguePublicationImageExpectation,
} from '@/lib/catalogue/publication-image-verification';

const candidateId = 'example-barrier-lotion';

function hash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function packshot(options: { clipped?: boolean; backgroundAlpha?: number; detachedEdge?: boolean } = {}) {
  const width = 1_800;
  const height = 1_800;
  const subject = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${options.clipped ? 0 : 570}" y="190" width="660" height="1420" rx="120" fill="#d75b73"/>
      <rect x="${options.clipped ? 60 : 630}" y="430" width="540" height="620" rx="28" fill="#fff7f2"/>
      ${options.detachedEdge ? '<rect x="120" y="0" width="100" height="100" fill="#d75b73"/>' : ''}
    </svg>
  `);
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: options.backgroundAlpha ?? 0 },
    },
  }).composite([{ input: subject }]).png().toBuffer();
}

function expectation(bytes: Buffer, overrides: Partial<CataloguePublicationImageExpectation> = {}): CataloguePublicationImageExpectation {
  const contentHash = hash(bytes);
  return {
    candidateId,
    url: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/${candidateId}/packshot-v1-${contentHash.slice(0, 16)}.png`,
    sha256: contentHash,
    mimeType: 'image/png',
    byteSize: bytes.length,
    width: 1_800,
    height: 1_800,
    ...overrides,
  };
}

test('accepts an exact transparent packshot on peach, pink and dark surfaces', async () => {
  const bytes = await packshot();
  const result = await verifyCataloguePublicationImageBytes(expectation(bytes), bytes);

  assert.equal(result.decodedFormat, 'png');
  assert.ok(result.metrics.zeroAlphaFraction > 0.5);
  assert.ok(result.metrics.edgeContactFraction < 0.01);
  assert.ok(result.metrics.surfaceBackgroundP90Delta <= 4);
});

test('accepts a broad realistic mostly white carton on transparent canvas', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <path d="M360 170 L1440 210 L1530 1570 L270 1610 Z" fill="#f7f5f2"/>
      <path d="M440 610 L1360 630 L1390 1160 L410 1165 Z" fill="#fffdfb" stroke="#d8d1ca" stroke-width="10"/>
      <rect x="540" y="740" width="720" height="220" rx="30" fill="#d75b73"/>
      <rect x="735" y="300" width="330" height="120" rx="24" fill="#55cbb2"/>
      <path d="M610 1300 H1190" stroke="#867b72" stroke-width="24" stroke-linecap="round"/>
    </svg>
  `) }]).png().toBuffer();

  const result = await verifyCataloguePublicationImageBytes(expectation(bytes), bytes);
  assert.ok(result.metrics.transparentFraction > 0.4);
  assert.ok(result.metrics.lightNeutralPlaneAreaFraction > 0.3);
  assert.ok(result.metrics.lightNeutralPlaneBoundsFraction > 0.45);
  assert.ok(result.metrics.lightNeutralPlaneFillFraction > 0.5);
});

test('surface verification stays bound to the product experience tokens', async () => {
  const css = (await readFile('app/product-experience.css', 'utf8')).toLowerCase();
  for (const [name, value] of Object.entries(cataloguePublicationSurfaces)) {
    assert.match(css, new RegExp(`--product-${name}:\\s*${value}`));
  }
});

test('rejects hash, decoded dimension and response MIME drift', async () => {
  const bytes = await packshot();
  const changedHash = 'b'.repeat(64);
  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes, {
      sha256: changedHash,
      url: `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/${candidateId}/packshot-v1-${changedHash.slice(0, 16)}.png`,
    }), bytes),
    /approved hash/,
  );
  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes, { width: 1_900 }), bytes),
    /decoded dimensions/,
  );
  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes, 'image/webp'),
    /response type changed/,
  );
});

test('rejects opaque or semi-transparent white canvases', async () => {
  for (const backgroundAlpha of [1, 0.08]) {
    const bytes = await packshot({ backgroundAlpha });
    await assert.rejects(
      verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
      /transparent canvas|semi-transparent plane/,
    );
  }
});

test('accepts a legitimate clear package even when much of the subject is translucent', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <rect x="530" y="260" width="740" height="1340" rx="160" fill="#a8d8e4" fill-opacity="0.42"/>
      <rect x="650" y="105" width="500" height="260" rx="55" fill="#aeb9c2"/>
      <rect x="620" y="790" width="560" height="330" rx="35" fill="#fff8f2"/>
      <circle cx="900" cy="945" r="70" fill="#55cbb2"/>
      <path d="M690 1280 Q900 1390 1110 1280" fill="none" stroke="#f8ffff" stroke-opacity="0.7" stroke-width="34" stroke-linecap="round"/>
    </svg>
  `) }]).png().toBuffer();

  const result = await verifyCataloguePublicationImageBytes(expectation(bytes), bytes);
  assert.ok(result.metrics.partiallyTransparentFraction > 0.18);
  assert.ok(result.metrics.partialAlphaPlaneBoundsFraction < 0.45);
});

test('rejects a broad inset semi-transparent canvas by topology and extent', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <rect x="225" y="225" width="1350" height="1350" fill="#8394a8" fill-opacity="0.45"/>
      <rect x="650" y="350" width="500" height="1100" rx="90" fill="#d75b73"/>
    </svg>
  `) }]).png().toBuffer();

  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /broad semi-transparent plane/,
  );
});

test('rejects a centered inset opaque white canvas disguised as the subject', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <rect x="225" y="225" width="1350" height="1350" fill="#ffffff"/>
    </svg>
  `) }]).png().toBuffer();

  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /inset opaque canvas/,
  );
});

test('rejects a colored product placed inside an inset opaque white photo plane', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <rect x="225" y="225" width="1350" height="1350" fill="#ffffff"/>
      <rect x="650" y="350" width="500" height="1100" rx="90" fill="#d75b73"/>
    </svg>
  `) }]).png().toBuffer();

  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /inset opaque canvas/,
  );
});

test('rejects a centered blue-gray studio plane independently of its color', async () => {
  const bytes = await sharp({
    create: { width: 1_800, height: 1_800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(`
    <svg width="1800" height="1800" xmlns="http://www.w3.org/2000/svg">
      <rect x="225" y="225" width="1350" height="1350" fill="#8394a8"/>
      <rect x="650" y="350" width="500" height="1100" rx="90" fill="#d75b73"/>
      <rect x="720" y="735" width="360" height="270" rx="25" fill="#fff7f2"/>
    </svg>
  `) }]).png().toBuffer();

  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /inset opaque canvas/,
  );
});

test('rejects a clipped subject even when the file has real alpha', async () => {
  const bytes = await packshot({ clipped: true });
  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /clipped|padding/,
  );
});

test('rejects a significant detached product piece touching an edge', async () => {
  const bytes = await packshot({ detachedEdge: true });
  await assert.rejects(
    verifyCataloguePublicationImageBytes(expectation(bytes), bytes),
    /clipped|padding/,
  );
});

test('rejects untrusted, unversioned and wrong-candidate asset locations before fetch', async () => {
  const bytes = await packshot();
  const urls = [
    `https://assets.example/products/example/example-barrier-lotion/packshot-v1-${hash(bytes).slice(0, 16)}.png`,
    'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/example-barrier-lotion/packshot.png',
    `https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/other-product/packshot-v1-${hash(bytes).slice(0, 16)}.png`,
  ];
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(new Uint8Array(bytes));
  }) as typeof fetch;

  for (const url of urls) {
    await assert.rejects(
      verifyRemoteCataloguePublicationImage(expectation(bytes, { url }), { fetchImpl }),
      /trusted immutable asset location|bind the exact candidate/,
    );
  }
  assert.equal(calls, 0);
});

test('remote verification refuses redirects and changed response metadata', async () => {
  const bytes = await packshot();
  const expected = expectation(bytes);
  const redirect = (async () => new Response(null, {
    status: 302,
    headers: { Location: expected.url },
  })) as typeof fetch;
  await assert.rejects(
    verifyRemoteCataloguePublicationImage(expected, { fetchImpl: redirect }),
    /redirects/,
  );

  const changedLength = (async () => new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length + 1) },
  })) as typeof fetch;
  await assert.rejects(
    verifyRemoteCataloguePublicationImage(expected, { fetchImpl: changedLength }),
    /response length changed/,
  );

  const partial = (async () => new Response(new Uint8Array(bytes), {
    status: 206,
    headers: { 'Content-Type': 'image/png' },
  })) as typeof fetch;
  await assert.rejects(
    verifyRemoteCataloguePublicationImage(expected, { fetchImpl: partial }),
    /not 200/,
  );

  const malformedLength = (async () => new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Content-Length': 'not-a-number' },
  })) as typeof fetch;
  await assert.rejects(
    verifyRemoteCataloguePublicationImage(expected, { fetchImpl: malformedLength }),
    /response length is invalid/,
  );

  const oversized = Buffer.concat([bytes, Buffer.from([0])]);
  const oversizedBody = (async () => ({
    status: 200,
    ok: true,
    url: '',
    headers: new Headers({ 'Content-Type': 'image/png' }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(oversized));
        controller.close();
      },
    }),
  }) as Response) as typeof fetch;
  await assert.rejects(
    verifyRemoteCataloguePublicationImage(expected, { fetchImpl: oversizedBody }),
    /exceeds the byte limit/,
  );
});

test('remote verification returns measured evidence only for exact response bytes', async () => {
  const bytes = await packshot();
  const expected = expectation(bytes);
  const fetchImpl = (async () => new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length) },
  })) as typeof fetch;
  const result = await verifyRemoteCataloguePublicationImage(expected, { fetchImpl });

  assert.equal(result.sha256, expected.sha256);
  assert.equal(result.byteSize, bytes.length);
  assert.ok(result.metrics.surfaceBackgroundMeanDelta < 0.01);
});

test('remote verification accepts exact chunked bytes without content-length', async () => {
  const bytes = await packshot();
  const expected = expectation(bytes);
  const fetchImpl = (async () => ({
    status: 200,
    ok: true,
    url: '',
    headers: new Headers({ 'Content-Type': 'image/png' }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        const midpoint = Math.floor(bytes.length / 2);
        controller.enqueue(new Uint8Array(bytes.subarray(0, midpoint)));
        controller.enqueue(new Uint8Array(bytes.subarray(midpoint)));
        controller.close();
      },
    }),
  }) as Response) as typeof fetch;

  const result = await verifyRemoteCataloguePublicationImage(expected, { fetchImpl });
  assert.equal(result.sha256, expected.sha256);
});
