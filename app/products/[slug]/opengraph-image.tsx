import { ImageResponse } from 'next/og';
import { products as staticProducts } from '@/data/catalogue';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { OG_SIZE, absoluteImage, loadImage, loadOgFonts, ngn } from '@/lib/og/assets';
import { summarizeMarket } from '@/modules/commerce/market-summary';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'JeloCare product';
export const revalidate = 3600;

// Pre-render one OG image per catalogue product at build time, matching the page,
// so social crawlers always hit a static, cached PNG.
export function generateStaticParams() {
  return staticProducts.map(product => ({ slug: product.slug }));
}

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  const fonts = await loadOgFonts();

  if (!product) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3ed', fontFamily: 'Italiana', fontSize: 64, color: '#2d211f' }}>
          JeloCare
        </div>
      ),
      { ...OG_SIZE, fonts },
    );
  }

  const imageSrc = await loadImage(absoluteImage(product.image));
  const summary = summarizeMarket(product.offers, 'NG');
  const lowest = summary.lowestPrice != null ? ngn(naira.format(summary.lowestPrice)) : null;
  const stores = summary.pricedRetailerCount;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: '#fbf3ed', fontFamily: 'Manrope' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#fffdf9', borderRadius: 40, boxShadow: '0 30px 90px rgba(112,71,61,.16)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: 430, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            {imageSrc ? <img src={imageSrc} width={330} height={430} style={{ objectFit: 'contain' }} alt="" /> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '48px 60px 48px 8px' }}>
            <div style={{ display: 'flex', fontSize: 19, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#7a6b66' }}>{product.brand}</div>
            <div style={{ display: 'flex', width: 600, fontFamily: 'Italiana', fontSize: 46, lineHeight: 1.12, color: '#2d211f', marginTop: 10, paddingBottom: 6 }}>{product.name}</div>
            <div style={{ display: 'flex', fontSize: 21, fontStyle: 'italic', color: '#7a6b66', marginTop: 18 }}>{product.size} · {product.category}</div>
            {lowest ? (
              <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 30 }}>
                <span style={{ fontFamily: 'Italiana', fontSize: 58, color: '#6b3b35' }}>From {lowest}</span>
                <span style={{ fontSize: 21, color: '#7a6b66', marginLeft: 18 }}>observed{stores > 1 ? ` · ${stores} stores` : ''}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 25, color: '#2d211f', marginTop: 30 }}>Products. Prices. Clear context.</div>
            )}
            <div style={{ display: 'flex', fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', color: '#9a8a83', marginTop: 'auto' }}>
              jelocare.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
