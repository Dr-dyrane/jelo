import type { Product } from '@/data/products';
import type { Market } from '@/data/prices';
import { ProductCard, type ProductCardProduct, type ProductCardContext } from './product-card';

export function ProductGrid({ products, market = 'NG' }: { products: Product[]; market?: Market }) {
  return <div className="product-grid">{products.map(product => <ProductCard key={product.slug} product={product} market={market} />)}</div>;
}

export function ProductRail({ products, market = 'NG' }: { products: Product[]; market?: Market }) {
  return <div className="product-rail">{products.map(product => <ProductCard key={product.slug} product={product} market={market} />)}</div>;
}

export function ProductCardGrid({ items, market = 'NG' }: {
  items: Array<{ product: ProductCardProduct; href?: string; context?: ProductCardContext; footer?: React.ReactNode }>;
  market?: Market;
}) {
  return <div className="product-grid">{items.map(({ product, href, context, footer }) => (
    <ProductCard key={product.slug} product={product} market={market} href={href} context={context} footer={footer} />
  ))}</div>;
}
