import Link from 'next/link';
import type { Product } from '@/data/products';
import type { Market } from '@/data/prices';
import { MarketPrice } from './market-price';
import { SafeProductImage } from './safe-product-image';
import styles from './product-card.module.css';

export function ProductCard({ product, market = 'NG' }: { product: Product; market?: Market }) {
  const href = `/products/${product.slug}`;
  return (
    <article className={`${styles.card} product-card`}>
      <Link className={styles.link} href={href} aria-label={`${product.brand} ${product.name}`}>
        <div className={`${styles.visual} product-visual`}>
          <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
        </div>
        <div className={`${styles.copy} product-copy`}>
          <p className="eyebrow">{product.brand}</p>
          <h3>{product.name}</h3>
          <div className={styles.meta}>
            <span>{product.size}</span>
            <span><MarketPrice offers={product.offers} market={market} /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}
