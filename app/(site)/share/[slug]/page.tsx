import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildShareData } from './share-data';
import { ShareCard } from './share-card';
import { ShareButton } from '@/components/share/share-button';
import styles from './share-card.module.css';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await buildShareData(slug);
  if (!data) return {};
  const title = `${data.view.brand} ${data.view.name}`;
  const description = data.headlineEmph
    ? `Same product, ${data.headlineEmph.replace(' apart.', '')} apart across ${data.storeCount} Nigerian stores. Observed ${data.view.observedDate}.`
    : `Observed in Nigeria, ${data.view.observedDate}. See where to find it.`;
  const url = `/share/${slug}`;
  // The og:image is generated automatically from opengraph-image.tsx in this segment.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await buildShareData(slug);
  if (!data) notFound();

  return (
    <main className={styles.stage}>
      <h1 className={styles.headline}>
        {data.headlineLead}
        {data.headlineEmph ? <><br /><em>{data.headlineEmph}</em></> : null}
      </h1>
      <ShareCard view={data.view} />
      <div className={styles.actions}>
        <ShareButton path={`/share/${slug}`} title={`${data.view.brand} ${data.view.name}`} />
        <Link href={`/products/${slug}`} className={styles.textLink}>See the full product →</Link>
      </div>
    </main>
  );
}
