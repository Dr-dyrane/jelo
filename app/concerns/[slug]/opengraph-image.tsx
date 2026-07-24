import { ImageResponse } from 'next/og';
import { concernBySlug, concerns } from '@/data/knowledge';
import { OG_SIZE, loadOgFonts } from '@/lib/og/assets';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'JeloCare skin guide';
export const revalidate = 3600;

export function generateStaticParams() {
  return concerns.map(concern => ({ slug: concern.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  const fonts = await loadOgFonts();

  if (!concern) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf3ed', fontFamily: 'Italiana', fontSize: 64, color: '#2d211f' }}>
          JeloCare
        </div>
      ),
      { ...OG_SIZE, fonts },
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: '#fbf3ed', fontFamily: 'Manrope' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', justifyContent: 'center', background: '#fffdf9', borderRadius: 40, boxShadow: '0 30px 90px rgba(112,71,61,.16)', padding: '72px 80px' }}>
          <div style={{ display: 'flex', fontSize: 19, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#6b3b35' }}>JeloCare · {concern.area}</div>
          <div style={{ display: 'flex', fontFamily: 'Italiana', fontSize: 84, lineHeight: 1.02, color: '#2d211f', marginTop: 20 }}>{concern.name}</div>
          <div style={{ display: 'flex', width: 900, fontSize: 30, lineHeight: 1.5, color: '#7a6b66', marginTop: 26 }}>{concern.summary}</div>
          <div style={{ display: 'flex', fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', color: '#9a8a83', marginTop: 44 }}>A guide, not a diagnosis · jelocare.com</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
