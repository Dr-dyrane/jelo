import { notFound } from 'next/navigation';
import { concerns, concernBySlug } from '@/data/knowledge';
import { products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';
import styles from '../concerns.module.css';

export function generateStaticParams() {
  return concerns.map(concern => ({ slug: concern.slug }));
}

export default async function ConcernPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concern = concernBySlug(slug);
  if (!concern) notFound();
  const matches = products.filter(product => product.concerns.some(value => concern.productTerms.some(term => value.includes(term) || term.includes(value))));

  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Concern pathway</p><h1>{concern.name}</h1><p>{concern.summary}</p></header>
    <section className={styles.detail}>
      <div className={styles.panel}><p className="eyebrow">What people notice</p><h2>Signals</h2><div className={styles.chips}>{concern.signals.map(item => <span key={item}>{item}</span>)}</div></div>
      <div className={styles.panel}><p className="eyebrow">Useful ingredient families</p><h2>Options</h2><div className={styles.chips}>{concern.ingredients.map(item => <span key={item}>{item}</span>)}</div><p className={styles.alert}>{concern.escalation}</p></div>
    </section>
    <section><p className="eyebrow">Matched catalogue</p><div className="section-heading"><h2>Products that fit this pathway.</h2></div><ProductGrid products={matches}/></section>
  </main>;
}
