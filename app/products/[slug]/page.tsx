import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { products as staticProducts } from '@/data/catalogue';
import { concerns } from '@/data/knowledge';
import { RetailerList } from '@/components/commerce/retailer-list';
import { MarketPrice } from '@/components/products/market-price';
import { ProductGrid } from '@/components/products/product-grid';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { findCatalogueProduct, listCatalogueProducts } from '@/lib/catalogue/repository';

export function generateStaticParams() {
  return staticProducts.map(product => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}`;
  const description = `${product.displayLine}. Best for ${product.bestFor.slice(0, 3).join(', ')}. Compare trusted places to buy.`;
  return { title, description, openGraph: { title, description, images: [product.image] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, products] = await Promise.all([
    findCatalogueProduct(slug),
    listCatalogueProducts(),
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

  return (
    <main className="product-page">
      <section className="product-hero">
        <div className="product-visual-large"><SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`}/></div>
        <div className="product-story">
          <p className="eyebrow">{product.brand}</p>
          <h1>{product.name}</h1>
          <div className="product-title-meta"><span>{product.size}</span><span>{product.category}</span><span>{product.step}</span></div>
          <p className="product-line">{product.displayLine}</p>
          <p className="product-page-price"><MarketPrice slug={product.slug}/></p>
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

      <section className="buy-section">
        <div><p className="eyebrow">Where to buy</p><h2>Best available options.</h2><p>Automatically ranked for your market by availability, trust and delivered value.</p></div>
        <RetailerList offers={product.offers} productSlug={product.slug}/>
      </section>

      {related.length ? <section className="related-products"><div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>Related care.</h2></div><Link className="text-link" href="/products">Browse all →</Link></div><ProductGrid products={related}/></section> : null}
    </main>
  );
}
