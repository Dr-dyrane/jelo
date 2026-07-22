import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { SafeEditorialImage } from '@/components/editorial/safe-editorial-image';
import { ProductRail } from '@/components/products/product-grid';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { products as curatedCatalogue } from '@/data/catalogue';
import { editorialAsset } from '@/data/editorial';
import { marketSignals } from '@/data/market-signals';
import type { Product } from '@/data/products';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import { hasVerifiedNigeriaOffer, orderByCuratedSlugs } from '@/modules/commerce/home-merchandising';
import styles from './home.module.css';

export const revalidate = 3600;

const heroAsset = editorialAsset('barrier-edit-hero');

const concernCards = [
  { label: 'Barrier care', query: 'barrier', asset: editorialAsset('barrier-care-cutout') },
  { label: 'Clear skin', query: 'acne', asset: editorialAsset('clearer-skin-cutout') },
  { label: 'Even tone', query: 'hyperpigmentation', asset: editorialAsset('even-tone-cutout') },
  { label: 'Daily SPF', query: 'sunscreen', asset: editorialAsset('daily-protection-cutout') },
  { label: 'Sensitive skin', query: 'sensitivity', asset: editorialAsset('sensitive-skin-cutout') },
];

const barrierAsset = editorialAsset('barrier-care-cutout');
const protectionAsset = editorialAsset('daily-protection-cutout');

function DiscoveryRail({ kicker, title, products: railProducts, href = '/products' }: {
  kicker: string;
  title: string;
  products: Product[];
  href?: string;
}) {
  if (!railProducts.length) return null;

  return (
    <section className={styles.railSection}>
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>{kicker}</p><h2>{title}</h2></div>
        <Link className="text-link" href={href}>View all <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <ProductRail products={railProducts} />
    </section>
  );
}

export default async function HomePage() {
  const liveCatalogue = await listCatalogueProducts();
  const products = orderByCuratedSlugs(liveCatalogue, curatedCatalogue.map(product => product.slug));
  const recommendations = products.filter(product => product.sensitiveFriendly).slice(0, 3);
  const editorsEdit = products.slice(0, 12);
  const newAndNoteworthy = products.slice(12, 24).length ? products.slice(12, 24) : products.slice(0, 12);
  const evidenceLed = products.filter(product => product.evidence === 'high');
  const acneCare = products.filter(product => product.concerns.some(concern => ['acne', 'blackheads', 'whiteheads', 'breakouts', 'body acne'].includes(concern)));
  const toneAndProtection = products.filter(product => product.step === 'Protect' || product.concerns.some(concern => ['hyperpigmentation', 'dark spots'].includes(concern)));
  const barrierCare = products.filter(product => product.concerns.some(concern => ['barrier', 'dryness', 'sensitivity'].includes(concern)));
  const kBeauty = products.filter(product => ['COSRX', 'ANUA', 'SOME BY MI', 'B.LAB'].includes(product.brand));
  const nigeriaReady = products.filter(hasVerifiedNigeriaOffer);
  const hairCare = products.filter(product => product.category === 'Hair');
  const bodyCare = products.filter(product => product.category === 'Body');

  return (
    <main className={styles.main}>
      <section className={styles.hero} style={{ backgroundImage: `url("${heroAsset.blobUrl}"), url("${heroAsset.localPath}")` }}>
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>The barrier edit</p>
          <h1>Skin, beautifully understood.</h1>
          <p className={styles.heroDeck}>Pharmacist-curated skincare.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/products?q=barrier">Explore the edit</Link>
            <Link className={styles.secondary} href="/consult">Ask JeloCare</Link>
          </div>
        </div>

        <div className={`${styles.glassCard} ${styles.glassFeature}`}>
          <span>JeloCare</span>
          <strong>Barrier care.</strong>
          <small>Comfort first</small>
        </div>

        <div className={styles.heroMeta}>
          <span>Soothes</span>
          <span>Repairs</span>
          <span>Protects</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.kicker}>Find your chapter</p><h2>Choose a concern.</h2></div>
          <Link className="text-link" href="/concerns">View all concerns <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.categoryGrid}>
          {concernCards.map((card, index) => (
            <Link className={styles.category} href={`/products?q=${encodeURIComponent(card.query)}`} key={card.label}>
              <small>0{index + 1}</small>
              <SafeEditorialImage asset={card.asset} alt={card.asset.altText} sizes="(max-width: 700px) 70vw, (max-width: 1000px) 30vw, 18vw" loading={index === 0 ? 'eager' : 'lazy'} />
              <div><span>{card.label}</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.story} editorial-story`}>
        <div className={`${styles.storyVisual} editorial-story-visual`}><SafeEditorialImage asset={barrierAsset} alt={barrierAsset.altText} sizes="(max-width: 1000px) 92vw, 46vw" /></div>
        <div className={`${styles.storyCopy} editorial-story-copy`}>
          <p className={styles.kicker}>This week&apos;s story</p>
          <h2>Back to comfort.</h2>
          <Link className={styles.storyLink} href="/products?q=barrier">Explore barrier care</Link>
        </div>
      </section>

      <section className="discovery-intro">
        <div>
          <p className="eyebrow">The JeloCare edit</p>
          <h2>What&apos;s good now.</h2>
          <div className="market-sources" aria-label="Nigeria stores checked">
            {marketSignals.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ArrowUpRight size={14} aria-hidden="true" /></a>)}
          </div>
        </div>
        <div className="signal-list">
          <span>Pharmacy care</span>
          <span>Clear skin</span>
          <span>Deep hydration</span>
          <span>Daily SPF</span>
        </div>
      </section>

      <DiscoveryRail
        kicker="Our shelf"
        title="Worth a look."
        products={editorsEdit}
      />

      <DiscoveryRail
        kicker="Pharmacist picks"
        title="Tried and trusted."
        products={evidenceLed}
      />

      <DiscoveryRail
        kicker="Clear skin"
        title="Keep it simple."
        products={acneCare}
        href="/products?q=acne"
      />

      <section className="evidence-banner">
        <div className="evidence-banner-copy">
          <p className="eyebrow">Every morning</p>
          <h2>Protect your progress.</h2>
          <ul className="evidence-points">
            <li>Prioritize SPF 30 or higher</li>
            <li>Look for broad-spectrum protection</li>
            <li>Reapply when sun exposure continues</li>
          </ul>
          <Link className={styles.primary} href="/products?q=sunscreen">Explore SPF</Link>
        </div>
        <SafeEditorialImage asset={protectionAsset} alt={protectionAsset.altText} sizes="(max-width: 900px) 80vw, 34vw" />
      </section>

      <DiscoveryRail
        kicker="Tone care"
        title="Protect. Then even."
        products={toneAndProtection}
        href="/products?q=hyperpigmentation"
      />

      <DiscoveryRail
        kicker="Comfort first"
        title="Barrier care."
        products={barrierCare}
        href="/products?q=barrier"
      />

      <DiscoveryRail
        kicker="K-beauty"
        title="The hydration edit."
        products={kBeauty}
      />

      <section className={styles.recommendation}>
        <div className={styles.recommendationCopy}>
          <p className={styles.kicker}>A gentle place to begin</p>
          <h3>Three gentle starts.</h3>
          <Link className={styles.primary} href="/products?q=sensitivity">Explore sensitive care</Link>
        </div>
        <div className={styles.formulaList} aria-label="Sensitive skin recommendations">
          {recommendations.map((product, index) => (
            <Link href={`/products/${product.slug}`} key={product.slug}>
              <span className={styles.formulaNumber}>0{index + 1}</span>
              <div className={styles.formulaText}><small>{product.brand}</small><strong>{product.name}</strong><em>{product.displayLine}</em></div>
              <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
            </Link>
          ))}
        </div>
      </section>

      <DiscoveryRail
        kicker="Checked in Nigeria"
        title="Priced here."
        products={nigeriaReady}
      />

      <DiscoveryRail
        kicker="Hair care"
        title="Scalp to ends."
        products={hairCare}
        href="/products?q=hair"
      />

      <DiscoveryRail
        kicker="Body care"
        title="Every day."
        products={bodyCare}
        href="/products?q=body"
      />

      <DiscoveryRail
        kicker="Just in"
        title="New on JeloCare."
        products={newAndNoteworthy}
      />

      <section className={styles.consult}>
        <p className={styles.kicker}>Personal guidance</p>
        <h2>Find your routine.</h2>
        <Link className={styles.consultLink} href="/consult">Start</Link>
      </section>
    </main>
  );
}
