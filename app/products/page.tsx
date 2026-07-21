import { Suspense } from 'react';
import { CatalogueExplorer } from '@/components/products/catalogue-explorer';
import { listCatalogueProducts } from '@/lib/catalogue/repository';

export const metadata = { title: 'Products' };

export default async function ProductsPage() {
  const products = await listCatalogueProducts();

  return (
    <main className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">The catalogue</p>
        <h1>Find what<br/>fits.</h1>
        <p>Search from the navbar, then refine by category, concern or market.</p>
      </header>
      <Suspense fallback={<div aria-live="polite">Loading catalogue…</div>}>
        <CatalogueExplorer products={products}/>
      </Suspense>
    </main>
  );
}
