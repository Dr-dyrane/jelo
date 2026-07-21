import Link from 'next/link';
import { ProductRail } from '@/components/products/product-grid';
import { products } from '@/data/catalogue';
import styles from './home.module.css';

const concernCards = [
  { label: 'Barrier repair', query: 'barrier', note: 'Comfort. Repair. Resilience.', product: products.find(product => product.concerns.includes('barrier')) ?? products[0] },
  { label: 'Clearer skin', query: 'acne', note: 'A calmer path to clarity.', product: products.find(product => product.concerns.includes('acne')) ?? products[1] },
  { label: 'Even tone', query: 'hyperpigmentation', note: 'Brightening without the noise.', product: products.find(product => product.concerns.includes('hyperpigmentation')) ?? products[2] },
  { label: 'Daily protection', query: 'sunscreen', note: 'The step that protects every other step.', product: products.find(product => product.step === 'Protect') ?? products[3] },
  { label: 'Sensitive skin', query: 'sensitivity', note: 'Less friction. More comfort.', product: products.find(product => product.sensitiveFriendly) ?? products[4] },
].filter(card => card.product);

export default function HomePage() {
  const storyProduct = products.find(product => product.concerns.includes('barrier')) ?? products[3] ?? products[0];
  const recommendations = products.filter(product => product.sensitiveFriendly).slice(0, 3);
  const editorsEdit = products.slice(0, 12);
  const newAndNoteworthy = products.slice(12, 24).length ? products.slice(12, 24) : products.slice(0, 12);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <img className={styles.heroCampaign} src="/editorial/jelocare-hero-campaign.webp" alt="JeloCare summer skincare campaign featuring Jelo" />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The JeloCare summer edit</p>
          <h1>Your best skin starts with confidence.</h1>
          <p className={styles.heroDeck}>Clinically guided care. Beautifully curated for the way real skin lives.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/products">Shop the edit</Link>
            <Link className={styles.secondary} href="/concerns">Explore concerns</Link>
          </div>
        </div>
        <div className={styles.heroEditorial}>
          <small>Summer edit</small>
          <strong>Restore.<br />Protect.<br />Glow.</strong>
          <span>Barrier-supporting essentials for hydrated, healthy, radiant skin.</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>Find your chapter</p><h2>Shop by concern.</h2></div>
          <Link href="/concerns">View all concerns →</Link>
        </div>
        <div className={styles.categoryGrid}>
          {concernCards.map((card, index) => (
            <Link className={styles.category} href={`/products?q=${encodeURIComponent(card.query)}`} key={card.label}>
              <small>0{index + 1} · Curated edit</small>
              <img src={card.product.image} alt={`${card.product.brand} ${card.product.name}`} />
              <div><span>{card.label}</span><p>{card.note}</p></div>
            </Link>
          ))}
        </div>
      </section>

      {storyProduct ? (
        <section className={styles.story}>
          <div className={styles.storyVisual}><img src={storyProduct.image} alt={`${storyProduct.brand} ${storyProduct.name}`} /></div>
          <div className={styles.storyCopy}>
            <p className={styles.kicker}>This week&apos;s story</p>
            <h2>The barrier recovery issue.</h2>
            <p>A considered edit for skin that feels tight, reactive or simply tired. Start with comfort, then build back strength.</p>
            <Link className={styles.storyLink} href="/products?q=barrier">Read the edit</Link>
          </div>
        </section>
      ) : null}

      <section className={styles.railSection}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>The editor&apos;s shelf</p><h2>Worth knowing.</h2></div>
          <Link href="/products">See the full collection →</Link>
        </div>
        <ProductRail products={editorsEdit} />
      </section>

      <section className={styles.recommendation}>
        <div className={styles.recommendationCopy}>
          <p className={styles.kicker}>A gentle place to begin</p>
          <h3>Three formulas for skin asking for less.</h3>
          <p>Comfort-first picks selected for sensitive-friendly routines and uncomplicated daily use.</p>
          <Link className={styles.primary} href="/products?q=sensitivity">Explore sensitive skin</Link>
        </div>
        <div className={styles.formulaList} aria-label="Sensitive skin recommendations">
          {recommendations.map((product, index) => (
            <Link href={`/products/${product.slug}`} key={product.slug}>
              <span className={styles.formulaNumber}>0{index + 1}</span>
              <div className={styles.formulaText}><small>{product.brand}</small><strong>{product.name}</strong><em>{product.displayLine}</em></div>
              <img src={product.image} alt={`${product.brand} ${product.name}`} />
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
