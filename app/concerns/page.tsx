import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { concerns } from '@/data/knowledge';
import styles from './concerns.module.css';

export default function ConcernsPage() {
  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Start here</p><h1>Skin and hair concerns.</h1><p>Choose what you want to improve.</p></header>
    <section className={styles.grid}>
      {concerns.map(concern => <Link className={styles.card} href={`/concerns/${concern.slug}`} key={concern.slug}>
        <div><p className="eyebrow">Concern</p><h2>{concern.name}</h2><p>{concern.summary}</p></div><ArrowUpRight size={22} strokeWidth={1.6}/>
      </Link>)}
    </section>
  </main>;
}
