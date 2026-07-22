import { ConcernSelector } from '@/components/concerns/concern-selector';
import { concerns } from '@/data/knowledge';
import { listRecommendationEligibleProducts } from '@/lib/catalogue/repository';

export const revalidate = 3600;

type SearchParams = { concerns?: string | string[] };

export default async function ConcernsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const products = await listRecommendationEligibleProducts();
  const valid = new Set(concerns.map(concern => concern.slug));
  const raw = Array.isArray(params.concerns) ? params.concerns[0] : params.concerns;
  const initialSelected = (raw ?? '').split(',').filter(slug => valid.has(slug));
  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Start here</p><h1>What do you notice?</h1><p>Choose one. Or a few.</p></header>
    <ConcernSelector concerns={concerns} products={products} initialSelected={initialSelected}/>
  </main>;
}
