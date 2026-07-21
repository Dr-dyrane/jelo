import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { concerns } from '@/data/knowledge';
import styles from './concerns.module.css';

export default function ConcernsPage() {
  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Start with the problem</p><h1>Skin and hair concerns.</h1><p>Browse pharmacist-structured pathways, then move directly into suitable products and trusted places to buy them.</p></header>
    <section className={styles.grid}>
      {concerns.map(concern => <Link className={styles.card} href={`/concerns/${concern.slug}`} key={concern.slug}>
        <div><p className="eyebrow">Concern</p><h2>{concern.name}</h2><p>{concern.summary}</p></div><ArrowUpRight size={22} strokeWidth={1.6}/>
      </Link>)}
    </section>
  </main>;
}
