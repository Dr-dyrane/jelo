import { CatalogueExplorer } from '@/components/products/catalogue-explorer';
import { products } from '@/data/catalogue';

export const metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <main className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">The catalogue</p>
        <h1>Find what<br/>fits.</h1>
        <p>Search by product, brand, concern or routine step. See only products with an available purchase route in your selected market.</p>
      </header>
      <CatalogueExplorer products={products}/>
    </main>
  );
}
