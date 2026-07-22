import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Clock3, ShieldCheck } from 'lucide-react';
import { nigeriaRetailers } from '@/data/retailers';
import { hasRegulatorMatch } from '@/modules/commerce/offer-evidence';
import styles from './retailers.module.css';

export const metadata: Metadata = {
  title: 'Retailer guide',
  description: 'The Nigerian beauty stores JeloCare checks, and what a current exact offer means.',
  alternates: { canonical: '/retailers' },
};

const directCount = nigeriaRetailers.filter(store => store.kind === 'retailer').length;

const standards = [
  { icon: BadgeCheck, title: 'Matched', copy: 'Product. Variant. Size.' },
  { icon: Clock3, title: 'Observed', copy: 'Price. Stock. Time.' },
  { icon: ShieldCheck, title: 'Separate', copy: 'Listing is not authenticity.' },
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
          <h2>Reference<br/>sources.</h2>
        </div>
        <div className={styles.storeGrid}>
          {nigeriaRetailers.map((store, index) => (
            <a href={store.homepage} target="_blank" rel="noreferrer" key={store.name}>
              <span className={styles.storeNumber}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.storeKind}>{store.reviewStatus === 'provisional' ? 'Provisional source' : store.kind === 'marketplace' ? 'Marketplace' : 'Direct retailer'}</span>
              <strong>{store.name}</strong>
              <small>{hasRegulatorMatch({ reviewStatus: store.reviewStatus, contentUse: store.contentUse, identity: store.identityEvidence, regulatorMatch: store.regulatorMatchEvidence })
                ? 'Regulator number matched to an independent register.'
                : store.identityEvidence
                  ? 'Self-published contact details observed. No regulator match.'
                  : store.kind === 'marketplace'
                    ? 'Seller identity is checked per offer when evidence exists.'
                    : 'No identity or regulator match recorded.'}</small>
              <ArrowUpRight size={18}/>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.disclosure}>
        <div>
          <p className="eyebrow">Our promise</p>
          <h2>Advice first.</h2>
          <p>A listing never proves authenticity.</p>
        </div>
        <div className={styles.disclosureActions}>
          <Link href="/products">Browse products <ArrowUpRight size={17}/></Link>
          <a href="mailto:hello@dyrane.tech?subject=JeloCare%20retail%20partnership">Retail partnerships</a>
        </div>
      </section>
    </main>
  );
}
