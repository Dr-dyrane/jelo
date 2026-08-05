import Link from 'next/link';
import type { Product } from '@/data/products';
import type { Offer } from '@/data/products';
import type { Market } from '@/data/prices';
import { MarketPrice } from './market-price';
import { SafeProductImage } from './safe-product-image';
import styles from './product-card.module.css';

export type ProductCardProduct = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  image: string;
  offers?: Offer[];
  priceLabel?: string | null;
};

export type ProductCardContext = {
  onShelf?: boolean;
  inRoutine?: boolean;
  reviewedConcern?: boolean;
  retailerNames?: readonly string[];
};

export function ProductCard({
  product,
  market = 'NG',
  href,
  context,
  footer,
}: {
  product: ProductCardProduct;
  market?: Market;
  href?: string;
  context?: ProductCardContext;
  footer?: React.ReactNode;
}) {
  const linkHref = href ?? `/products/${product.slug}`;
  const priceLabel = product.offers
    ? <MarketPrice offers={product.offers} market={market} />
    : product.priceLabel ?? '';
  const contextBadges = context
    ? [
      context.onShelf ? <span key="shelf">On your Shelf</span> : null,
      context.inRoutine ? <span key="routine">In your routine</span> : null,
      context.reviewedConcern ? <span key="concern">Reviewed concern support</span> : null,
      ...(context.retailerNames ?? []).map(name => <span key={`retailer-${name}`}>{name}</span>),
    ].filter(Boolean)
    : [];
  return (
    <article className={`${styles.card} product-card`}>
      <Link className={styles.link} href={linkHref} aria-label={`${product.brand} ${product.name}`}>
        <div className={`${styles.visual} product-visual`}>
          <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
        </div>
        <div className={`${styles.copy} product-copy`}>
          <p className="eyebrow">{product.brand}</p>
          <h3>{product.name}</h3>
          <div className={styles.meta}>
            <span>{product.size}</span>
            <span>{priceLabel}</span>
          </div>
          {contextBadges.length ? <div className={styles.context}>{contextBadges}</div> : null}
        </div>
      </Link>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </article>
  );
}

export function ProductCardFromProduct({ product, market = 'NG' }: { product: Product; market?: Market }) {
  return <ProductCard product={product} market={market} />;
}
