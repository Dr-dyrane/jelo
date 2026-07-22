import { Suspense } from 'react';
import { ConcernSelector } from '@/components/concerns/concern-selector';
import { concerns } from '@/data/knowledge';
import { listCatalogueProducts } from '@/lib/catalogue/repository';

export const revalidate = 3600;

export default async function ConcernsPage() {
  const products = await listCatalogueProducts();
  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Start here</p><h1>What do you notice?</h1><p>Choose one. Or a few.</p></header>
    <Suspense fallback={<p className="sr-only">Loading concern selector</p>}>
      <ConcernSelector concerns={concerns} products={products}/>
    </Suspense>
  </main>;
}
