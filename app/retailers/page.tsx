import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Clock3, ShieldCheck } from 'lucide-react';
import { nigeriaRetailers } from '@/data/retailers';
import styles from './retailers.module.css';

export const metadata: Metadata = {
  title: 'Retailer guide',
  description: 'The Nigerian beauty stores JeloCare checks, and what a current exact offer means.',
  alternates: { canonical: '/retailers' },
};

const directCount = nigeriaRetailers.filter(store => store.kind === 'retailer').length;

const standards = [
  { icon: BadgeCheck, title: 'Exact', copy: 'Product. Strength. Size.' },
  { icon: Clock3, title: 'Current', copy: 'Fresh checks only.' },
  { icon: ShieldCheck, title: 'Independent', copy: 'Commission never sets rank.' },
];

export default function RetailersPage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div>
          <p className="eyebrow">Retailer guide</p>
          <h1>Stores<br/>we check.</h1>
          <p>Nigeria first. Exact products only.</p>
        </div>
        <div className={styles.metrics} aria-label="Retailer guide summary">
          <span><strong>{nigeriaRetailers.length}</strong><small>sources</small></span>
          <span><strong>{directCount}</strong><small>direct</small></span>
          <span><strong>7d</strong><small>maximum</small></span>
        </div>
      </section>

      <section className={styles.standardSection}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">A price means</p>
          <h2>Checked.<br/>Not guessed.</h2>
        </div>
        <div className={styles.standards}>
          {standards.map(({ icon: Icon, title, copy }, index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <Icon size={22}/>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.directory}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Nigeria</p>
          <h2>Reviewed<br/>sources.</h2>
        </div>
        <div className={styles.storeGrid}>
          {nigeriaRetailers.map((store, index) => (
            <a href={store.homepage} target="_blank" rel="noreferrer" key={store.name}>
              <span className={styles.storeNumber}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.storeKind}>{store.kind === 'marketplace' ? 'Marketplace' : 'Direct retailer'}</span>
              <strong>{store.name}</strong>
              <small>{store.kind === 'marketplace' ? 'Seller checks apply.' : 'Product pages checked directly.'}</small>
              <ArrowUpRight size={18}/>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.disclosure}>
        <div>
          <p className="eyebrow">Our promise</p>
          <h2>Advice first.</h2>
          <p>Some links pay us. They never change the order.</p>
        </div>
        <div className={styles.disclosureActions}>
          <Link href="/products">Compare products <ArrowUpRight size={17}/></Link>
          <a href="mailto:hello@dyrane.tech?subject=JeloCare%20retail%20partnership">Retail partnerships</a>
        </div>
      </section>
    </main>
  );
}
