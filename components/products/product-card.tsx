import Link from 'next/link';
import type { Product } from '@/data/products';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link className="product-visual" href={`/products/${product.slug}`}>
        <span>{product.step}</span>
        <img src={product.image} alt={`${product.brand} ${product.name}`} />
      </Link>
      <div className="product-copy">
        <p className="eyebrow">{product.brand}</p>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-size">{product.size}</p>
        <p className="product-line">{product.displayLine}</p>
        <Link className="text-link" href={`/products/${product.slug}`}>View product →</Link>
      </div>
    </article>
  );
}
