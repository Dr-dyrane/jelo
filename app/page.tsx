import Link from 'next/link';
import { ProductRail } from '@/components/products/product-grid';
import { products } from '@/data/catalogue';
import styles from './home.module.css';

const concernCards = [
  { label: 'Barrier repair', query: 'barrier', note: 'Comfort. Repair. Resilience.', tone: 'rose' },
  { label: 'Clearer skin', query: 'acne', note: 'A calmer path to clarity.', tone: 'wine' },
  { label: 'Even tone', query: 'hyperpigmentation', note: 'Brightening without the noise.', tone: 'sand' },
  { label: 'Daily protection', query: 'sunscreen', note: 'The step that protects every other step.', tone: 'sun' },
  { label: 'Sensitive skin', query: 'sensitivity', note: 'Less friction. More comfort.', tone: 'pearl' },
];

export default function HomePage() {
  const recommendations = products.filter(product => product.sensitiveFriendly).slice(0, 3);
  const editorsEdit = products.slice(0, 12);
  const newAndNoteworthy = products.slice(12, 24).length ? products.slice(12, 24) : products.slice(0, 12);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The JeloCare summer edit</p>
          <h1>Skin, beautifully understood.</h1>
          <p className={styles.heroDeck}>Discover formulas chosen for fit, evidence and the way real skin lives. Quietly guided by pharmacist-led intelligence.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/products">Explore the edit</Link>
            <Link className={styles.secondary} href="/concerns">Shop by concern</Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <span className={styles.heroIssue}>01</span>
          <div className={styles.heroPortrait}>
            <div className={styles.heroHalo} />
            <div className={styles.heroSilhouette} />
            <span>THE SKIN ISSUE</span>
          </div>
          <div className={styles.heroCaption}>
            <strong>Summer, softened.</strong>
            <span>Barrier-first care for heat, sun and long days.</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>Find your chapter</p><h2>Shop by concern.</h2></div>
          <Link href="/concerns">View all concerns →</Link>
        </div>
        <div className={styles.categoryGrid}>
          {concernCards.map((card, index) => (
            <Link className={`${styles.category} ${styles[card.tone]}`} href={`/products?q=${encodeURIComponent(card.query)}`} key={card.label}>
              <small>0{index + 1} · Curated edit</small>
              <div className={styles.categoryArt} aria-hidden="true"><span /><span /></div>
              <div><span>{card.label}</span><p>{card.note}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.story}>
        <div className={styles.storyVisual} aria-hidden="true">
          <div className={styles.storyDisc} />
          <p>CARE<br />BEFORE<br />CORRECTION</p>
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.kicker}>This week&apos;s story</p>
          <h2>The barrier recovery issue.</h2>
          <p>A considered edit for skin that feels tight, reactive or simply tired. Start with comfort, then build back strength.</p>
          <Link className={styles.storyLink} href="/products?q=barrier">Read the edit</Link>
        </div>
      </section>

      <section className={styles.railSection}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>The editor&apos;s shelf</p><h2>Worth knowing.</h2></div>
          <Link href="/products">See the full collection →</Link>
        </div>
        <ProductRail products={editorsEdit} />
      </section>

      <section className={styles.recommendation}>
        <div>
          <p className={styles.kicker}>A gentle place to begin</p>
          <h3>Three formulas for skin asking for less.</h3>
          <p>Comfort-first picks selected from the catalogue for sensitive-friendly routines and uncomplicated daily use.</p>
          <Link className={styles.primary} href="/products?q=sensitivity">Explore sensitive skin</Link>
        </div>
        <div className={styles.recommendationIndex}>
          {recommendations.map((product, index) => (
            <Link href={`/products/${product.slug}`} key={product.slug}>
              <small>0{index + 1}</small>
              <strong>{product.brand}</strong>
              <span>{product.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.railSection}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>New and noteworthy</p><h2>Fresh on the shelf.</h2></div>
          <Link href="/products">Browse everything →</Link>
        </div>
        <ProductRail products={newAndNoteworthy} />
      </section>

      <section className={styles.consult}>
        <p className={styles.kicker}>Personal guidance</p>
        <h2>Not sure where to begin?</h2>
        <p>Meet JeloCare&apos;s skin consultation: thoughtful guidance, clear routines and product recommendations shaped around what your skin is telling you.</p>
        <Link className={styles.consultLink} href="/consult">Start a skin consultation</Link>
      </section>
    </main>
  );
}
