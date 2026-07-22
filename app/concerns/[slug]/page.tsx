import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { concerns, concernBySlug } from '@/data/knowledge';
import { ProductGrid } from '@/components/products/product-grid';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import styles from '../concerns.module.css';

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
  const matches = products.filter(product => product.concerns.some(value => concern.productTerms.some(term => value.includes(term) || term.includes(value))));

  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Concern</p><h1>{concern.name}</h1><p>{concern.summary}</p></header>
    <section className={styles.detail}>
      <div className={styles.panel}><p className="eyebrow">What you may notice</p><h2>Signs</h2><div className={styles.chips}>{concern.signals.map(item => <span key={item}>{item}</span>)}</div></div>
      <div className={styles.panel}><p className="eyebrow">Ingredients to consider</p><h2>Options</h2><div className={styles.chips}>{concern.ingredients.map(item => <span key={item}>{item}</span>)}</div><p className={styles.alert}>{concern.escalation}</p></div>
    </section>
    <section><p className="eyebrow">Products</p><div className="section-heading"><h2>What fits.</h2></div><ProductGrid products={matches}/></section>
  </main>;
}
