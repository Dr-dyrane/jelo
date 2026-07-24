import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { hasShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { buildShareData } from './share-data';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
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

const ogDir = join(process.cwd(), 'app', 'share', '[slug]', '_og');
const loadFont = (file: string) => readFile(join(ogDir, file));

function absolute(image: string) {
  return image.startsWith('http') ? image : `https://www.jelocare.com${image}`;
}

// Fetch the packshot ourselves (with a timeout) and inline it as a data URL, so
// generation never hangs on a slow image and a fetch failure degrades to a card
// without the shot rather than failing the whole build.
async function loadImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('content-type') ?? 'image/png';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await buildShareData(slug);
  const [italiana, manrope, manropeSemibold] = await Promise.all([
    loadFont('italiana-400.ttf'),
    loadFont('manrope-400.ttf'),
    loadFont('manrope-600.ttf'),
  ]);
  const fonts = [
    { name: 'Italiana', data: italiana, weight: 400 as const },
    { name: 'Manrope', data: manrope, weight: 400 as const },
    { name: 'Manrope', data: manropeSemibold, weight: 600 as const },
  ];

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3ed', fontFamily: 'Italiana', fontSize: 64, color: '#2d211f' }}>
          JeloCare
        </div>
      ),
      { ...size, fonts },
    );
  }

  const { view } = data;
  const imageSrc = await loadImage(absolute(view.image));
  const primary = view.offers[0];
  const secondary = view.offers[1];
  // The Latin font subset has no naira glyph, so spell it in the image only.
  const ngn = (label: string) => label.replace('₦', 'NGN ');

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
              <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
                <span style={{ fontFamily: 'Italiana', fontSize: 58, color: '#6b3b35' }}>{ngn(view.spreadLabel)}</span>
                <span style={{ fontSize: 21, color: '#7a6b66', marginLeft: 18 }}>lowest to highest</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
              {primary ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 25, color: '#2d211f' }}>{primary.retailer}{primary.isLowest ? ' · lowest' : ''}</span>
                  <span style={{ fontSize: 29, fontWeight: 600, color: '#2d211f' }}>{ngn(primary.priceLabel)}</span>
                </div>
              ) : null}
              {secondary ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 15, borderTop: '1px solid rgba(112,71,61,.14)', marginTop: 15 }}>
                  <span style={{ fontSize: 25, color: '#7a6b66' }}>{secondary.retailer}</span>
                  <span style={{ fontSize: 29, fontWeight: 600, color: '#2d211f' }}>{ngn(secondary.priceLabel)}</span>
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
    { ...size, fonts },
  );
}
