import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SafeEditorialImage } from '@/components/editorial/safe-editorial-image';
import { ProductRail } from '@/components/products/product-grid';
import type { EditorialAsset } from '@/data/editorial';
import type { Market } from '@/data/prices';
import type { ReviewedProduct } from '@/data/products';
import styles from '@/app/(site)/products/products.module.css';

export function DiscoveryRail({
  eyebrow,
  title,
  products,
  market,
  href: railHref,
}: {
  eyebrow: string;
  title: string;
  products: ReviewedProduct[];
  market: Market;
  href: string;
}) {
  if (!products.length) return null;
  return <section className={styles.shelf}>
    <div className={styles.sectionHeading}><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="text-link" href={railHref}>View all <ArrowRight size={16} aria-hidden="true"/></Link></div>
    <ProductRail products={products.slice(0, 12)} market={market}/>
  </section>;
}

export function CatalogueStories({
  allSkinAsset,
  scalpAsset,
  ageAsset,
}: {
  allSkinAsset: EditorialAsset;
  scalpAsset: EditorialAsset;
  ageAsset: EditorialAsset;
}) {
  return <section className={styles.stories} aria-label="Care stories">
    <article><div className={styles.storyImage}><SafeEditorialImage asset={allSkinAsset} alt={allSkinAsset.altText} sizes="(max-width: 820px) 82vw, 33vw"/></div><div className={styles.storyCopy}><p>Every skin</p><h2>No one palette.</h2><Link href="/concerns">Explore concerns <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
    <article><div className={styles.storyImage}><SafeEditorialImage asset={scalpAsset} alt={scalpAsset.altText} sizes="(max-width: 820px) 82vw, 33vw"/></div><div className={styles.storyCopy}><p>Hair & scalp</p><h2>Start at the root.</h2><Link href="/concerns/dandruff-itchy-scalp">Read the scalp guide <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
    <article><div className={styles.storyImage}><SafeEditorialImage asset={ageAsset} alt={ageAsset.altText} sizes="(max-width: 820px) 82vw, 33vw"/></div><div className={styles.storyCopy}><p>Simple care</p><h2>Made for change.</h2><Link href="/consult">Ask JeloCare <ArrowRight size={15} aria-hidden="true"/></Link></div></article>
  </section>;
}
