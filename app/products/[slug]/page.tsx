import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { products as staticProducts } from '@/data/catalogue';
import { concerns } from '@/data/knowledge';
import { MarketPrice } from '@/components/products/market-price';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductQuickPanel } from '@/components/products/product-quick-panel';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { findCatalogueProduct, listCatalogueProducts } from '@/lib/catalogue/repository';
import { listProductIngredientsSafe } from '@/lib/clinical/ingredients';
import { getProductPriceTrends } from '@/lib/inventory/price-trends';
import { productStructuredData, serializeJsonLd } from '@/modules/commerce/product-structured-data';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

const evidenceCopy = {
  high: 'Well supported. Results vary.',
  moderate: 'Good support. Results vary.',
  emerging: 'Promising. Still learning.',
} as const;

export const revalidate = 3600;

function routinePlacement(category: 'Face' | 'Hair' | 'Body', step: string) {
  if (category === 'Hair') return [
    { title: 'Prepare', detail: 'Wet, section or detangle as the product directions require.' },
    { title: step, detail: 'Use the amount and contact time on the label.' },
    { title: 'Complete', detail: 'Condition, moisturize or style only as your hair and scalp need.' },
  ];
  if (category === 'Body') return [
    { title: 'Prepare', detail: 'Start with clean skin; leave it slightly damp for moisturizers and oils.' },
    { title: step, detail: 'Apply evenly and follow the package directions.' },
    { title: 'Complete', detail: 'Protect exposed skin with broad-spectrum sunscreen during the day.' },
  ];
  return [
    { title: 'Prepare', detail: step === 'Cleanse' ? 'Wet skin and keep the water comfortably lukewarm.' : 'Begin with a gentle cleanse and let skin settle.' },
    { title: step, detail: 'Use this product at the frequency shown above; reduce use if irritation develops.' },
    { title: 'Complete', detail: step === 'Protect' ? 'Apply generously and reapply with continued sun exposure.' : 'Follow with moisturizer; finish mornings with broad-spectrum SPF.' },
  ];
}

export function generateStaticParams() {
  return staticProducts.map(product => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}`;
  const description = `${product.displayLine}. Best for ${product.bestFor.slice(0, 3).join(', ')}. Compare trusted places to buy.`;
  const url = `/products/${product.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images: [product.image] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, products, priceTrends, productIngredients] = await Promise.all([
    findCatalogueProduct(slug),
    listCatalogueProducts(),
    getProductPriceTrends(slug),
    listProductIngredientsSafe(slug),
  ]);
  if (!product) notFound();

  const matchedConcerns = concerns.filter(concern => productMatchesConcern(product, concern));

  const related = products
    .filter(item => item.slug !== product.slug)
    .map(item => ({
      item,
      score:
        item.concerns.filter(concern => product.concerns.includes(concern)).length * 3 +
        (item.category === product.category ? 2 : 0) +
        (item.step === product.step ? 1 : 0),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(result => result.item);
  const routine = routinePlacement(product.category, product.step);
  const panelIngredients = productIngredients.slice(0, 8).map(ingredient => {
    const concentration = ingredient.concentrationPercent == null ? '' : `${ingredient.concentrationPercent}% `;
    return {
      id: ingredient.id,
      label: `${concentration}${ingredient.commonName ?? ingredient.inciName}`,
      sourceUrl: ingredient.sourceUrl ?? undefined,
    };
  });
  const structuredData = productStructuredData(product);

  return (
    <>
      {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}/> : null}
      <main className="product-page">
      <section className="product-hero">
        <div className="product-visual-large"><SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`}/></div>
        <div className="product-story">
          <p className="eyebrow">{product.brand}</p>
          <h1>{product.name}</h1>
          <div className="product-title-meta"><span>{product.size}</span><span>{product.category}</span><span>{product.step}</span></div>
          <p className="product-line">{product.displayLine}</p>
          <p className="product-page-price"><MarketPrice offers={product.offers} market="NG"/></p>
          <ProductQuickPanel
            productSlug={product.slug}
            productName={product.name}
            offers={product.offers}
            priceTrends={priceTrends}
            bestFor={product.bestFor}
            usage={product.usage}
            evidence={evidenceCopy[product.evidence]}
            caution={product.sensitiveFriendly ? 'Introduce one change at a time.' : 'Patch test. Start slowly.'}
            ingredients={panelIngredients}
            routine={routine}
          />
          {matchedConcerns.length ? <div className="product-concern-links">{matchedConcerns.map(concern => <Link key={concern.slug} href={`/concerns/${concern.slug}`}>{concern.name}</Link>)}</div> : null}
          <dl className="facts">
            <div><dt>Best for</dt><dd>{product.bestFor.join(' · ')}</dd></div>
            <div><dt>Use</dt><dd>{product.usage}</dd></div>
            <div><dt>Care note</dt><dd>{product.sensitiveFriendly ? 'Introduce one change at a time.' : 'Patch test. Start slowly.'}</dd></div>
          </dl>
        </div>
      </section>

        {related.length ? <section className="related-products"><div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>Related care.</h2></div><Link className="text-link" href="/products">Browse all <ArrowRight size={16} aria-hidden="true" /></Link></div><ProductGrid products={related}/></section> : null}
      </main>
    </>
  );
}
