import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Product } from '@/data/products';
import { MarketPrice } from './market-price';
import styles from './product-card.module.css';

export function ProductCardV2({ product }: { product: Product }) {
  const href = `/products/${product.slug}`;
  return <article className={`${styles.card} product-card`}>
    <Link className={`${styles.visual} product-visual`} href={href} aria-label={`${product.brand} ${product.name}`}>
      <span className={styles.step}>{product.step}</span>
      <span className={styles.price}><MarketPrice slug={product.slug}/></span>
      <img src={product.image} alt={`${product.brand} ${product.name}`} />
      <span className={styles.reveal} aria-hidden="true"><ArrowUpRight size={20} strokeWidth={1.9}/></span>
    </Link>
    <div className={`${styles.copy} product-copy`}><p className="eyebrow">{product.brand}</p><h3><Link href={href}>{product.name}</Link></h3><div className={styles.meta}><span>{product.size}</span><span>{product.displayLine}</span></div></div>
  </article>;
}
