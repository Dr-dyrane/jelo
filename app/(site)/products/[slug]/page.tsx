import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { products as staticProducts } from '@/data/catalogue';
import { concerns } from '@/data/knowledge';
import { getReviewedProductCare } from '@/data/product-care-review';
import { isPublishedIntakeProduct } from '@/data/published-intake-products';
import { MarketPrice } from '@/components/products/market-price';
import { ProductGrid } from '@/components/products/product-grid';
import { ProductQuickPanel } from '@/components/products/product-quick-panel';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { readProductPanelData } from '@/lib/catalogue/product-panel-model';
import { findCatalogueProduct, listCatalogueProducts } from '@/lib/catalogue/repository';
import { productStructuredData, serializeJsonLd } from '@/modules/commerce/product-structured-data';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

export const revalidate = 3600;

export function generateStaticParams() {
  return staticProducts.map(product => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}`;
  const description = `${product.brand} ${product.name}, ${product.size}. Product details and observed store listings.`;
  const url = `/products/${product.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images: [product.image] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) notFound();

  const [products, panelData] = await Promise.all([
    listCatalogueProducts(),
    readProductPanelData(product),
  ]);

  const careReview = getReviewedProductCare(product.slug);
  const catalogueVerified = isPublishedIntakeProduct(product.slug);
  const careStatus = careReview?.careState === 'supportive_eligible'
    ? 'Supportive use'
    : careReview?.careState === 'pharmacist_review'
      ? 'Pharmacist review'
      : catalogueVerified ? null : 'Formula review pending';

  const matchedConcerns = concerns.filter(concern => productMatchesConcern(product, concern));

  const related = products
    .filter(item => item.slug !== product.slug)
    .map(item => ({
      item,
      score:
        (item.category === product.category ? 2 : 0) +
        (item.step === product.step ? 1 : 0),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(result => result.item);
  const structuredData = productStructuredData(product);

  return (
    <>
      {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}/> : null}
      <main className="product-page">
      <section className="product-hero">
        <div className="product-visual-large"><SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} priority/></div>
        <div className="product-story">
          <p className="eyebrow">{product.brand}</p>
          <h1>{product.name}</h1>
          <div className="product-title-meta"><span>{product.size}</span><span>{product.category}</span><span>{product.step}</span></div>
          {careStatus ? <p className="product-line">{careStatus}</p> : null}
          <p className="product-page-price"><MarketPrice offers={product.offers} market="NG"/></p>
          <ProductQuickPanel {...panelData} />
          {matchedConcerns.length ? <div className="product-concern-links">{matchedConcerns.map(concern => <Link key={concern.slug} href={`/concerns/${concern.slug}`}>{concern.name}</Link>)}</div> : null}
        </div>
      </section>

        {related.length ? <section className="related-products"><div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>More to browse.</h2></div><Link className="text-link" href="/products">View all <ArrowRight size={16} aria-hidden="true" /></Link></div><ProductGrid products={related}/></section> : null}
      </main>
    </>
  );
}
