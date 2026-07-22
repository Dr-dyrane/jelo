import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers3 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { concerns, concernBySlug } from '@/data/knowledge';
import { ProductRail } from '@/components/products/product-grid';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { productMatchesConcern } from '@/modules/concerns/product-matching';

export const revalidate = 3600;

export function generateStaticParams() {
  return concerns.map(concern => ({ slug: concern.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) return {};
  return {
    title: concern.name,
    description: concern.summary,
    alternates: { canonical: `/concerns/${concern.slug}` },
  };
}

export default async function ConcernPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) notFound();
  const products = await listCatalogueProducts();
  const matches = products.filter(product => productMatchesConcern(product, concern));

  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">{concern.area}</p><h1>{concern.name}</h1><p>{concern.summary}</p><Link className="concern-combine" href={`/concerns?concerns=${concern.slug}`}><Layers3 size={16} aria-hidden="true"/> Add another concern</Link></header>
    <section className="concern-detail-grid">
      <div className="concern-detail-panel"><p className="eyebrow">What it looks like</p><h2>Signs</h2><div className="concern-detail-chips">{concern.signals.map(item => <span key={item}>{item}</span>)}</div></div>
      <div className="concern-detail-panel"><p className="eyebrow">What may help</p><h2>Options</h2><div className="concern-detail-chips">{concern.ingredients.map(item => <span key={item}>{item}</span>)}</div></div>
      <div className="concern-detail-panel concern-help-panel"><p className="eyebrow">When to get help</p><h2>Pause here</h2><p className="concern-alert">{concern.escalation}</p></div>
    </section>
    <section className="concern-matches"><p className="eyebrow">Products</p><div className="section-heading"><h2>For this concern.</h2></div><ProductRail products={matches}/></section>
  </main>;
}
