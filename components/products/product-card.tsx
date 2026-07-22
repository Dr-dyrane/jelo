import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getReviewedProductCare } from '@/data/product-care-review';
import type { Product } from '@/data/products';
import type { Market } from '@/data/prices';
import { MarketPrice } from './market-price';
import { SafeProductImage } from './safe-product-image';
import styles from './product-card.module.css';

export function ProductCard({ product, market = 'NG' }: { product: Product; market?: Market }) {
  const href = `/products/${product.slug}`;
  const review = getReviewedProductCare(product.slug);
  const profileLabel = review?.careState === 'supportive_eligible'
    ? review.approvedUses.map(use => use.label).join(' · ')
    : review?.careState === 'pharmacist_review'
      ? 'Needs pharmacist review'
      : 'Care review pending';
  return (
    <article className={`${styles.card} product-card`}>
      <Link className={`${styles.visual} product-visual`} href={href} aria-label={`${product.brand} ${product.name}`}>
        <span className={styles.step}>{product.category}</span>
        <span className={styles.price}><MarketPrice offers={product.offers} market={market} /></span>
        <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
        <span className={styles.reveal} aria-hidden="true"><ArrowUpRight size={20} strokeWidth={1.9} /></span>
      </Link>
      <div className={`${styles.copy} product-copy`}>
        <p className="eyebrow">{product.brand}</p>
        <h3><Link href={href}>{product.name}</Link></h3>
        <div className={styles.meta}><span>{product.size}</span><span>{profileLabel}</span></div>
      </div>
    </article>
  );
}
