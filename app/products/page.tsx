import { ProductGrid } from '@/components/products/product-grid';
import { products } from '@/data/products';

export const metadata = { title: 'Products' };

export default function ProductsPage() {
  return <main className="page-shell"><header className="page-heading"><p className="eyebrow">The catalogue</p><h1>Products,<br/>properly considered.</h1><p>Clean pages. Clear use. Trusted purchase routes.</p></header><ProductGrid products={products}/></main>;
}
