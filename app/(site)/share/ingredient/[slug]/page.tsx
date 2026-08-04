import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ingredientSeedBySlug, ingredientSeeds } from '@/data/product-ingredients';
import { ShareButton } from '@/components/share/share-button';
import { ingredientSocialCard, publicSocialMetadata } from '@/lib/og/social-card';
import { IngredientShareCard } from './ingredient-share-card';
import styles from './ingredient-share.module.css';

export function generateStaticParams() {
  return ingredientSeeds.map(seed => ({ slug: seed.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seed = ingredientSeedBySlug(slug);
  if (!seed) return {};
  const url = `/share/ingredient/${slug}`;
  const card = ingredientSocialCard(slug);
  return card ? publicSocialMetadata(card, url) : {};
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
