import type { Product } from '@/data/products';
import { ProductCard } from './product-card';

export function ProductGrid({ products }: { products: Product[] }) {
  return <div className="product-grid">{products.map(product => <ProductCard key={product.slug} product={product} />)}</div>;
}

export function ProductRail({ products }: { products: Product[] }) {
  return <div className="product-rail">{products.map(product => <ProductCard key={product.slug} product={product} />)}</div>;
}
