import type { Product } from '@/data/products';
import type { Market } from '@/data/prices';
import { ProductCard } from './product-card';

export function ProductGrid({ products, market = 'NG' }: { products: Product[]; market?: Market }) {
  return <div className="product-grid">{products.map(product => <ProductCard key={product.slug} product={product} market={market} />)}</div>;
}

export function ProductRail({ products, market = 'NG' }: { products: Product[]; market?: Market }) {
  return <div className="product-rail">{products.map(product => <ProductCard key={product.slug} product={product} market={market} />)}</div>;
}
