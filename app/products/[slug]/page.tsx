import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { products as staticProducts } from '@/data/catalogue';
import { concerns } from '@/data/knowledge';
import { RetailerList } from '@/components/commerce/retailer-list';
import { StoreSearches } from '@/components/commerce/store-searches';
import { MarketPrice } from '@/components/products/market-price';
import { ProductGrid } from '@/components/products/product-grid';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { findCatalogueProduct, listCatalogueProducts } from '@/lib/catalogue/repository';
import { listProductIngredientsSafe } from '@/lib/clinical/ingredients';
import { getProductPriceTrends } from '@/lib/inventory/price-trends';
import { productStructuredData, serializeJsonLd } from '@/modules/commerce/product-structured-data';

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

  const matchedConcerns = concerns.filter(concern =>
    product.concerns.some(value => concern.productTerms.some(term => value.includes(term) || term.includes(value))),
  );

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
          <p className="product-page-price"><MarketPrice slug={product.slug} offers={product.offers} market="NG"/></p>
          {matchedConcerns.length ? <div className="product-concern-links">{matchedConcerns.map(concern => <Link key={concern.slug} href={`/concerns/${concern.slug}`}>{concern.name}</Link>)}</div> : null}
          <dl className="facts">
            <div><dt>Best for</dt><dd>{product.bestFor.join(' · ')}</dd></div>
            <div><dt>Use</dt><dd>{product.usage}</dd></div>
            <div><dt>Skin / hair type</dt><dd>{product.skinTypes.join(' · ')}</dd></div>
            <div><dt>Sensitive-friendly</dt><dd>{product.sensitiveFriendly ? 'Generally suitable when introduced carefully' : 'Patch test and introduce slowly'}</dd></div>
            <div><dt>Evidence</dt><dd>{product.evidence}</dd></div>
          </dl>
        </div>
      </section>

      <section className="product-decision-guide">
        <div className="product-decision-heading">
          <p className="eyebrow">At a glance</p>
          <h2>Right for you?</h2>
        </div>
        <div className="decision-grid">
          <article className="decision-card">
            <small>01</small>
            <h3>Best for</h3>
            <ul>{product.bestFor.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className="decision-card">
            <small>02</small>
            <h3>How to use</h3>
            <p>{product.usage}</p>
            {!product.sensitiveFriendly ? <p>Patch test. Add one new active at a time.</p> : null}
          </article>
          <article className="decision-card">
            <small>03</small>
            <h3>What we know</h3>
            <p>{evidenceCopy[product.evidence]}</p>
          </article>
        </div>
      </section>

      <section className={`ingredient-disclosure ${productIngredients.length ? '' : 'ingredient-disclosure-pending'}`}>
        <div>
          <p className="eyebrow">Formula</p>
          <h2>{productIngredients.length ? 'Key ingredients.' : 'Review pending.'}</h2>
        </div>
        <div className="ingredient-disclosure-content">
          {productIngredients.length ? <div className="ingredient-chips">
            {productIngredients.slice(0, 8).map(ingredient => {
              const concentration = ingredient.concentrationPercent == null ? '' : `${ingredient.concentrationPercent}% `;
              const label = `${concentration}${ingredient.commonName ?? ingredient.inciName}`;
              return ingredient.sourceUrl ? <a key={ingredient.id} href={ingredient.sourceUrl} target="_blank" rel="noreferrer">{label} ↗</a> : <span key={ingredient.id}>{label}</span>;
            })}
          </div> : null}
          <p>{productIngredients.length ? 'Key ingredients only. Check your pack.' : 'Check the pack before use.'}</p>
        </div>
      </section>

      <section className="routine-placement">
        <div>
          <p className="eyebrow">Your routine</p>
          <h2>Where it fits.</h2>
        </div>
        <div className="routine-steps" aria-label={`${product.name} routine placement`}>
          {routine.map((item, index) => (
            <div className={`routine-step ${index === 1 ? 'active' : ''}`} key={`${item.title}-${index}`}>
              <span>0{index + 1}</span>
              <div><strong>{item.title}</strong><small>{item.detail}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="buy-section">
        <div>
          <p className="eyebrow">Where to buy</p>
          <h2>Best options.</h2>
          <p>Stock. Trust. Value.</p>
          <p className="affiliate-note">Some links earn commission. It never changes the order.</p>
        </div>
        <div className="retailer-stack">
          <RetailerList offers={product.offers} productSlug={product.slug} priceTrends={priceTrends}/>
          <StoreSearches productSlug={product.slug} exactRetailers={product.offers.filter(offer => offer.match !== 'search').map(offer => offer.retailer)}/>
        </div>
      </section>

        {related.length ? <section className="related-products"><div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>Related care.</h2></div><Link className="text-link" href="/products">Browse all →</Link></div><ProductGrid products={related}/></section> : null}
      </main>
    </>
  );
}
