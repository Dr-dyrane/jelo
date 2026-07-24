import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ingredientSeedBySlug, ingredientSeeds } from '@/data/product-ingredients';
import { ShareButton } from '@/components/share/share-button';
import { IngredientShareCard } from './ingredient-share-card';
import styles from './ingredient-share.module.css';

export function generateStaticParams() {
  return ingredientSeeds.map(seed => ({ slug: seed.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seed = ingredientSeedBySlug(slug);
  if (!seed) return {};
  const title = seed.commonName;
  const description = seed.summary;
  const url = `/share/ingredient/${slug}`;
  // The og:image is generated from opengraph-image.tsx in this segment.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function IngredientSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = ingredientSeedBySlug(slug);
  if (!seed) notFound();

  return (
    <main className={styles.stage}>
      <h1 className={styles.headline}>{seed.commonName}. <em>Source-checked.</em></h1>
      <IngredientShareCard seed={seed} />
      <div className={styles.actions}>
        <ShareButton path={`/share/ingredient/${slug}`} title={seed.commonName} />
        <Link href={`/ingredients?ingredient=${slug}`} className={styles.textLink}>See the library →</Link>
      </div>
    </main>
  );
}
