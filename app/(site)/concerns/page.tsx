import { ConcernSelector } from '@/components/concerns/concern-selector';
import { EditorialEntry } from '@/components/editorial/editorial-entry';
import { editorialAsset } from '@/data/editorial';
import { concerns } from '@/data/knowledge';
import { listRecommendationEligibleProducts } from '@/lib/catalogue/repository';
import { publicSocialMetadata, staticSocialCard } from '@/lib/og/social-card';
import { isProductMatchConcern } from '@/modules/concerns/product-matching';

export const revalidate = 3600;
export const metadata = publicSocialMetadata(staticSocialCard('concerns'), '/concerns');

const storyAsset = editorialAsset('concerns-together-story');

type SearchParams = { concerns?: string | string[] };

export default async function ConcernsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const products = await listRecommendationEligibleProducts();
  const valid = new Set(concerns.filter(isProductMatchConcern).map(concern => concern.slug));
  const raw = Array.isArray(params.concerns) ? params.concerns[0] : params.concerns;
  const initialSelected = (raw ?? '').split(',').filter(slug => valid.has(slug));
  return <main className="page-shell">
    <EditorialEntry asset={storyAsset} priority>
      <header className="page-heading"><p className="eyebrow">Start here</p><h1>What do you notice?</h1><p>Choose one. Or a few.</p></header>
    </EditorialEntry>
    <ConcernSelector concerns={concerns} products={products} initialSelected={initialSelected}/>
  </main>;
}
