import { ImageResponse } from 'next/og';
import { absoluteImage, loadImage, loadOgFonts, OG_SIZE } from '@/lib/og/assets';
import {
  resolveSocialCard,
  SocialCard,
  socialCardVersion,
  staticSocialCard,
} from '@/lib/og/social-card';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const card = await resolveSocialCard(requestUrl, async slug => {
    const { findCatalogueProduct } = await import('@/lib/catalogue/repository');
    return findCatalogueProduct(slug);
  }, async slug => {
    const [{ retailerBySlug }, { listCatalogueProducts }, { buildRetailerProfile }] = await Promise.all([
      import('@/data/retailers'),
      import('@/lib/catalogue/repository'),
      import('@/modules/commerce/retailer-profile'),
    ]);
    const retailer = retailerBySlug(slug);
    if (!retailer) return undefined;
    const profile = buildRetailerProfile(retailer, await listCatalogueProducts());
    return { slug, name: retailer.name, productCount: profile.productCount };
  });
  const resolvedCard = card ?? staticSocialCard('home');
  const [fonts, packshotSrc] = await Promise.all([
    loadOgFonts(),
    resolvedCard.packshot ? loadImage(absoluteImage(resolvedCard.packshot)) : Promise.resolve(null),
  ]);
  const versionMatches = requestUrl.searchParams.get('v') === socialCardVersion(resolvedCard);

  return new ImageResponse(
    <SocialCard card={resolvedCard} packshotSrc={packshotSrc} />,
    {
      ...OG_SIZE,
      fonts,
      headers: {
        'Cache-Control': versionMatches
          ? 'public, max-age=31536000, s-maxage=31536000, immutable'
          : 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
