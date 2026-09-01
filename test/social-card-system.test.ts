import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { products } from '@/data/catalogue';
import { GET as renderSocialImage } from '@/app/og/route';
import {
  NON_INDEXABLE_ROUTE_COVERAGE,
  PUBLIC_SOCIAL_ROUTE_COVERAGE,
  SITE_ORIGIN,
  SocialCard,
  brandSocialCard,
  catalogueSocialCard,
  productSocialCard,
  publicSocialMetadata,
  retailerSocialCard,
  resolveSocialCard,
  socialCardVersion,
  socialImageUrl,
  staticSocialCard,
} from '@/lib/og/social-card';

const root = process.cwd();

const MARKET_FIXTURE_PAGES = [
  'app/(site)/markets/page.tsx',
  'app/(site)/markets/[marketSlug]/page.tsx',
  'app/(site)/markets/[marketSlug]/shops/[shopSlug]/page.tsx',
] as const;

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  });
}

function relative(absolute: string) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function imageUrl(image: unknown) {
  if (typeof image === 'string') return image;
  if (image instanceof URL) return image.toString();
  if (image && typeof image === 'object' && 'url' in image) {
    const value = (image as { url: string | URL }).url;
    return value.toString();
  }
  return null;
}

function firstImage(images: unknown) {
  return Array.isArray(images) ? images[0] : images;
}

test('every public page family has explicit contextual social metadata', () => {
  const appFiles = filesBelow(path.join(root, 'app')).map(relative);
  const sitePages = appFiles
    .filter(file => file.startsWith('app/(site)/') && /\/page\.(?:ts|tsx)$/.test(file))
    .sort();
  const covered = PUBLIC_SOCIAL_ROUTE_COVERAGE.map(route => route.source).sort();
  const intentionallyNoindex = [
    'app/(site)/basket/page.tsx',
    'app/(site)/checkout/page.tsx',
    'app/(site)/go/page.tsx',
    'app/(site)/image-audit/page.tsx',
    'app/(site)/order/page.tsx',
    ...MARKET_FIXTURE_PAGES,
  ];

  assert.deepEqual(sitePages, [...covered, ...intentionallyNoindex].sort());
  for (const route of PUBLIC_SOCIAL_ROUTE_COVERAGE) {
    const source = readFileSync(path.join(root, route.source), 'utf8');
    assert.match(
      source,
      /publicSocialMetadata/,
      `${route.family} must build route-specific Open Graph and Twitter metadata`,
    );
  }

  const imageFiles = appFiles.filter(file => /\/(?:opengraph|twitter)-image\.(?:ts|tsx)$/.test(file));
  assert.deepEqual(imageFiles, [], 'route-local image files must not bypass the shared renderer');

  const rootLayout = readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
  assert.doesNotMatch(rootLayout, /jelocare-open-graph-v1|openGraph:|twitter:/);
});

test('the full page tree is classified as contextual public or intentionally non-indexable', () => {
  const pageFiles = filesBelow(path.join(root, 'app'))
    .map(relative)
    .filter(file => /\/page\.(?:ts|tsx)$/.test(file));

  const publicFiles = new Set(PUBLIC_SOCIAL_ROUTE_COVERAGE.map(route => route.source));
  const classified = pageFiles.filter(file => (
    publicFiles.has(file as (typeof PUBLIC_SOCIAL_ROUTE_COVERAGE)[number]['source'])
    || file === 'app/(site)/basket/page.tsx'
    || file === 'app/(site)/checkout/page.tsx'
    || file === 'app/(site)/go/page.tsx'
    || file === 'app/(site)/image-audit/page.tsx'
    || file === 'app/(site)/order/page.tsx'
    || MARKET_FIXTURE_PAGES.includes(file as (typeof MARKET_FIXTURE_PAGES)[number])
    || file.startsWith('app/(auth)/')
    || file.startsWith('app/(customer)/me/')
    || file.startsWith('app/(ops)/ops/')
  ));

  assert.deepEqual(classified.sort(), pageFiles.sort());
  assert.deepEqual(
    NON_INDEXABLE_ROUTE_COVERAGE.map(route => route.family),
    ['/basket', '/checkout', '/order', '/image-audit', '/go', '/sign-in', '/me', '/ops'],
  );
});

test('product and share routes preserve exact SKU identity and exact packshot binding', async () => {
  assert.ok(products.length >= 2);
  const shortest = [...products].sort((left, right) => left.name.length - right.name.length)[0];
  const longest = [...products].sort((left, right) => right.name.length - left.name.length)[0];
  assert.notEqual(shortest.slug, longest.slug);

  const productCard = productSocialCard(shortest, 'product');
  const longShareCard = productSocialCard(longest, 'share');
  assert.equal(productCard.request.slug, shortest.slug);
  assert.equal(productCard.packshot, shortest.image);
  assert.equal(productCard.title, shortest.name);
  assert.match(productCard.eyebrow, new RegExp(shortest.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(longShareCard.request.slug, longest.slug);
  assert.equal(longShareCard.packshot, longest.image);
  assert.equal(longShareCard.title, longest.name);
  assert.notEqual(productCard.packshot, longShareCard.packshot);

  const resolved = await resolveSocialCard(new URL(socialImageUrl(longShareCard)));
  assert.equal(resolved?.request.slug, longest.slug);
  assert.equal(resolved?.packshot, longest.image);
  assert.equal(resolved?.title, longest.name);
});

test('missing product media produces a truthful text fallback', () => {
  const card = productSocialCard({
    slug: 'missing-media-fixture',
    brand: 'Fixture Brand',
    name: 'Long Product Name That Still Keeps Its Exact Identity',
    size: '100 ml',
    category: 'Face',
    image: '/product-placeholder.svg',
  }, 'product');

  assert.equal(card.packshot, null);
  const markup = renderToStaticMarkup(createElement(SocialCard, { card, packshotSrc: null }));
  assert.match(markup, /Fixture Brand/);
  assert.match(markup, /Long Product Name That Still Keeps Its Exact Identity/);
  assert.match(markup, /Exact packshot unavailable/);
  assert.doesNotMatch(markup, /<img/);
});

test('canonical URLs are absolute and Open Graph/Twitter stay in parity', () => {
  const filtered = catalogueSocialCard({ category: 'Hair', market: 'US', sort: 'newest' });
  const metadata = publicSocialMetadata(filtered.card, filtered.canonicalPath);
  const canonical = metadata.alternates?.canonical?.toString();
  const openGraph = metadata.openGraph;
  const twitter = metadata.twitter;

  assert.equal(canonical, `${SITE_ORIGIN}/products?category=Hair&market=US`);
  assert.equal(openGraph?.url?.toString(), canonical);
  assert.equal(openGraph?.title, twitter?.title);
  assert.equal(openGraph?.description, twitter?.description);
  assert.equal((twitter as { card?: string })?.card, 'summary_large_image');
  const openGraphImage = firstImage(openGraph?.images);
  const twitterImage = firstImage(twitter?.images);
  assert.equal(imageUrl(openGraphImage), imageUrl(twitterImage));
  assert.ok(imageUrl(openGraphImage)?.startsWith(`${SITE_ORIGIN}/og?`));
  assert.equal(
    (openGraphImage as { alt?: string }).alt,
    (twitterImage as { alt?: string }).alt,
  );
});

test('social image URLs change when route or product content changes', () => {
  const product = products[0];
  const card = productSocialCard(product, 'product');
  const renamed = productSocialCard({ ...product, name: `${product.name} Updated` }, 'product');
  const newPackshot = productSocialCard({ ...product, image: `${product.image}?revision=2` }, 'product');

  assert.notEqual(socialCardVersion(card), socialCardVersion(renamed));
  assert.notEqual(socialCardVersion(card), socialCardVersion(newPackshot));
  assert.notEqual(socialImageUrl(card), socialImageUrl(renamed));
  assert.notEqual(socialImageUrl(card), socialImageUrl(newPackshot));
});

test('retailer profile cards preserve exact retailer identity and observed depth', async () => {
  const beautyHut = retailerSocialCard({
    slug: 'beauty-hut-africa',
    name: 'Beauty Hut Africa',
    productCount: 15,
  });
  const buyBetter = retailerSocialCard({
    slug: 'buybetter',
    name: 'BuyBetter',
    productCount: 42,
  });

  assert.notEqual(socialImageUrl(beautyHut), socialImageUrl(buyBetter));
  assert.notEqual(beautyHut.title, buyBetter.title);
  assert.match(beautyHut.description, /15 products/);
  const resolved = await resolveSocialCard(
    new URL(socialImageUrl(beautyHut)),
    undefined,
    async slug => slug === beautyHut.request.slug
      ? { slug, name: 'Beauty Hut Africa', productCount: 15 }
      : undefined,
  );
  assert.deepEqual(resolved, beautyHut);
});

test('brand profile cards preserve exact brand identity and catalogue depth', async () => {
  const dang = brandSocialCard({
    slug: 'dang-lifestyle',
    name: 'DANG! Lifestyle',
    productCount: 3,
    categoryCount: 2,
  });
  const cerave = brandSocialCard({
    slug: 'cerave',
    name: 'CeraVe',
    productCount: 12,
    categoryCount: 2,
  });

  assert.notEqual(socialImageUrl(dang), socialImageUrl(cerave));
  assert.match(dang.description, /3 products/);
  const resolved = await resolveSocialCard(
    new URL(socialImageUrl(dang)),
    undefined,
    undefined,
    async slug => slug === dang.request.slug
      ? { slug, name: 'DANG! Lifestyle', productCount: 3, categoryCount: 2 }
      : undefined,
  );
  assert.deepEqual(resolved, dang);
});

test('the shared endpoint emits cacheable 1200x630 PNG images', async () => {
  const card = staticSocialCard('home');
  const response = await renderSocialImage(new Request(socialImageUrl(card)));
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^image\/png/);
  assert.match(response.headers.get('cache-control') ?? '', /immutable/);
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);

  const stale = new URL(socialImageUrl(card));
  stale.searchParams.set('v', 'stale');
  const staleResponse = await renderSocialImage(new Request(stale));
  assert.match(staleResponse.headers.get('cache-control') ?? '', /s-maxage=300/);
});

test('private customer and operations layouts are noindex, no-store, and have no social payload', () => {
  for (const sourcePath of [
    'app/(customer)/me/layout.tsx',
    'app/(ops)/layout.tsx',
  ]) {
    const source = readFileSync(path.join(root, sourcePath), 'utf8');
    assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    assert.match(source, /openGraph:\s*null/);
    assert.match(source, /twitter:\s*null/);
    assert.match(source, /unstable_noStore as noStore/);
    assert.match(source, /noStore\(\)/);
    assert.doesNotMatch(source, /operator\.|customer\.|session\.|email.*openGraph/i);
  }

  const middleware = readFileSync(path.join(root, 'middleware.ts'), 'utf8');
  assert.match(middleware, /PRIVATE_WORKSPACE_ROUTE/);
  assert.match(middleware, /private, no-store, max-age=0/);
  assert.match(middleware, /noindex, nofollow, noarchive/);
});
