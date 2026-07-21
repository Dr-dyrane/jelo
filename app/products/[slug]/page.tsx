import { notFound } from 'next/navigation';
import { products } from '@/data/products';
import { RetailerList } from '@/components/commerce/retailer-list';

export function generateStaticParams() {
  return products.map(product => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find(item => item.slug === slug);
  if (!product) notFound();

  return <main className="product-page">
    <section className="product-hero">
      <div className="product-visual-large"><img src={product.image} alt={`${product.brand} ${product.name}`}/></div>
      <div className="product-story"><p className="eyebrow">{product.brand}</p><h1>{product.name}</h1><p className="product-size">{product.size}</p><p className="product-line">{product.displayLine}</p><dl className="facts"><div><dt>Best for</dt><dd>{product.bestFor.join(' · ')}</dd></div><div><dt>Use</dt><dd>{product.usage}</dd></div><div><dt>Step</dt><dd>{product.step}</dd></div><div><dt>Evidence</dt><dd>{product.evidence}</dd></div></dl></div>
    </section>
    <section className="buy-section"><div><p className="eyebrow">Where to buy</p><h2>Best available options.</h2><p>Ranked by trust, location, availability and value — never commission.</p></div><RetailerList offers={product.offers} productSlug={product.slug}/></section>
  </main>;
}
