import { ImageResponse } from 'next/og';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { OG_SIZE, absoluteImage, loadImage, loadOgFonts, ngn } from '@/lib/og/assets';
import { hasShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { buildShareData } from './share-data';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'JeloCare observed Nigerian prices for this product';
// Refresh the pre-built image hourly so observed prices stay current.
export const revalidate = 3600;

// Pre-render the OG image for every shareable product at build time, so a social
// scraper always hits a static, CDN-cached PNG instead of a cold on-demand render
// (which timed out slow crawlers). Non-shareable slugs 404 on the page anyway.
export async function generateStaticParams() {
  const products = await listCatalogueProducts();
  return products.filter(product => hasShareableNgOffer(product)).map(product => ({ slug: product.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await buildShareData(slug);
  const fonts = await loadOgFonts();

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3ed', fontFamily: 'Italiana', fontSize: 64, color: '#2d211f' }}>
          JeloCare
        </div>
      ),
      { ...OG_SIZE, fonts },
    );
  }

  const { view } = data;
  const imageSrc = await loadImage(absoluteImage(view.image));
  const primary = view.offers[0];
  const secondary = view.offers[1];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: '#fbf3ed', fontFamily: 'Manrope' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#fffdf9', borderRadius: 40, boxShadow: '0 30px 90px rgba(112,71,61,.16)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: 430, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            {imageSrc ? <img src={imageSrc} width={330} height={430} style={{ objectFit: 'contain' }} alt="" /> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '48px 60px 48px 8px' }}>
            <div style={{ display: 'flex', fontSize: 19, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#7a6b66' }}>{view.brand}</div>
            <div style={{ display: 'flex', width: 600, fontFamily: 'Italiana', fontSize: 46, lineHeight: 1.12, color: '#2d211f', marginTop: 10, paddingBottom: 6 }}>{view.name}</div>
            <div style={{ display: 'flex', fontSize: 21, fontStyle: 'italic', color: '#7a6b66', marginTop: 18 }}>{view.microtag}</div>
            {view.spreadLabel ? (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'Italiana', fontSize: 58, color: '#6b3b35' }}>{ngn(view.spreadLabel)}</span>
                  {view.marketTrend ? <span style={{ fontSize: 18, fontWeight: 600, color: view.marketTrend.direction === 'down' ? '#33704a' : '#9a3d35' }}>Market {view.marketTrend.label}</span> : null}
                </div>
                <span style={{ fontSize: 21, color: '#7a6b66', marginLeft: 18 }}>lowest to highest</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
              {primary ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 25, color: '#2d211f' }}>{primary.retailer}{primary.isLowest ? ' · lowest' : ''}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 29, fontWeight: 600, color: '#2d211f' }}>
                    {ngn(primary.priceLabel)}
                    {primary.trend ? <span style={{ fontSize: 16, color: primary.trend.direction === 'down' ? '#33704a' : '#9a3d35' }}>{primary.trend.label}</span> : null}
                  </span>
                </div>
              ) : null}
              {secondary ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 15, borderTop: '1px solid rgba(112,71,61,.14)', marginTop: 15 }}>
                  <span style={{ fontSize: 25, color: '#7a6b66' }}>{secondary.retailer}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 29, fontWeight: 600, color: '#2d211f' }}>
                    {ngn(secondary.priceLabel)}
                    {secondary.trend ? <span style={{ fontSize: 16, color: secondary.trend.direction === 'down' ? '#33704a' : '#9a3d35' }}>{secondary.trend.label}</span> : null}
                  </span>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', color: '#9a8a83', marginTop: 30 }}>
              Observed in Nigeria · {view.observedDate} · jelocare.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
