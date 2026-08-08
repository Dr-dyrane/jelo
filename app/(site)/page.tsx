import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { SafeEditorialImage } from "@/components/editorial/safe-editorial-image";
import { ProductRail } from "@/components/products/product-grid";
import { products as curatedCatalogue } from "@/data/catalogue";
import { editorialAsset } from "@/data/editorial";
import { marketSignals } from "@/data/market-signals";
import type { Product } from "@/data/products";
import {
  listCatalogueProducts,
  listRecommendationEligibleProducts,
} from "@/lib/catalogue/repository";
import { orderByCuratedSlugs } from "@/modules/commerce/home-merchandising";
import { getMarketTrendsReadModel } from "@/lib/share/market-trends";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "./home.module.css";
import editorialStyles from "./home-editorial.module.css";

export const revalidate = 3600;
export const metadata = publicSocialMetadata(staticSocialCard("home"), "/");

const heroAsset = editorialAsset("morning-care-lagos");

const concernCards = [
  {
    label: "Barrier guide",
    href: "/concerns/sensitive-barrier",
    asset: editorialAsset("barrier-care-cutout"),
  },
  {
    label: "Breakout guide",
    href: "/concerns/acne-breakouts",
    asset: editorialAsset("clearer-skin-cutout"),
  },
  {
    label: "Dark spot guide",
    href: "/concerns/dark-spots",
    asset: editorialAsset("even-tone-cutout"),
  },
  {
    label: "Scalp guide",
    href: "/concerns/dandruff-itchy-scalp",
    asset: editorialAsset("daily-protection-cutout"),
  },
  {
    label: "Hair guide",
    href: "/concerns/dry-frizzy-hair",
    asset: editorialAsset("sensitive-skin-cutout"),
  },
];

const storyAsset = editorialAsset("catalogue-all-skin-story");
const protectionAsset = editorialAsset("daily-protection-cutout");

function DiscoveryRail({
  kicker,
  title,
  products: railProducts,
  href = "/products",
  linkLabel = "View all",
  ariaLabel,
}: {
  kicker: string;
  title: string;
  products: Product[];
  href?: string;
  linkLabel?: string;
  ariaLabel?: string;
}) {
  if (!railProducts.length) return null;

  return (
    <section className={styles.railSection} aria-label={ariaLabel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>{kicker}</p>
          <h2>{title}</h2>
        </div>
        <Link className="text-link" href={href}>
          {linkLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ProductRail products={railProducts} />
    </section>
  );
}

function MarketTrendsTeaser({
  trends,
}: {
  trends: Awaited<ReturnType<typeof getMarketTrendsReadModel>>;
}) {
  const { priceDrops, priceIncreases } = trends;
  const topDrop = priceDrops[0];
  const topRise = priceIncreases[0];
  if (!topDrop && !topRise) return null;

  return (
    <section className={styles.tickerSection} aria-label="Market trends">
      <div className={styles.tickerCanvas}>
        <div className={styles.tickerHead}>
          <p className={styles.kicker}>Market trends</p>
          <Link className={styles.tickerCta} href="/share">
            See all <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.tickerGrid}>
          {topDrop ? (
            <Link href={`/share/${topDrop.slug}`} className={styles.tickerCard}>
              <TrendingDown
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
                className={styles.iconDown}
              />
              <span className={styles.tickerBrand}>{topDrop.brand}</span>
              <strong className={styles.tickerName}>{topDrop.name}</strong>
              <span className={`${styles.tickerStat} ${styles.down}`}>
                {topDrop.trendLabel}
              </span>
            </Link>
          ) : null}
          {topRise ? (
            <Link href={`/share/${topRise.slug}`} className={styles.tickerCard}>
              <TrendingUp
                size={14}
                strokeWidth={1.5}
                aria-hidden="true"
                className={styles.iconUp}
              />
              <span className={styles.tickerBrand}>{topRise.brand}</span>
              <strong className={styles.tickerName}>{topRise.name}</strong>
              <span className={`${styles.tickerStat} ${styles.up}`}>
                {topRise.trendLabel}
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

async function MarketTrendsSection() {
  const trends = await getMarketTrendsReadModel();
  return <MarketTrendsTeaser trends={trends} />;
}

export default async function HomePage() {
  const [liveCatalogue, eligibleProducts] = await Promise.all([
    listCatalogueProducts(),
    listRecommendationEligibleProducts(),
  ]);
  const products = orderByCuratedSlugs(
    liveCatalogue,
    curatedCatalogue.map((product) => product.slug),
  );
  const supportiveProducts = orderByCuratedSlugs(
    eligibleProducts,
    curatedCatalogue.map((product) => product.slug),
  );

  // Five mutually-exclusive rails — no product appears in more than one rail.
  // This reduces cognitive load and gives each rail a distinct purpose.
  const seenSlugs = new Set<string>();

  function takeRail(pool: Product[], limit: number): Product[] {
    const picked: Product[] = [];
    for (const product of pool) {
      if (seenSlugs.has(product.slug)) continue;
      seenSlugs.add(product.slug);
      picked.push(product);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  // Rail 1: The main catalogue entry — first 12 by curation
  const editorsEdit = takeRail(products, 12);

  // Rail 2: Care-reviewed supportive products not already shown
  const supportiveRail = takeRail(supportiveProducts, 12);

  // Rail 3: Face care not already shown
  const faceCare = takeRail(
    products.filter((p) => p.category === "Face"),
    12,
  );

  // Rail 4: Hair & body merged, not already shown
  const hairAndBody = takeRail(
    products.filter((p) => p.category === "Hair" || p.category === "Body"),
    12,
  );

  // Rail 5: Everything else
  const keepBrowsing = takeRail(products, 12);

  const heroCategories = [
    products.some((p) => p.category === "Face") ? "Face" : null,
    products.some((p) => p.category === "Hair") ? "Hair" : null,
    products.some((p) => p.category === "Body") ? "Body" : null,
  ].filter((label): label is string => Boolean(label));
  const catalogueSignals = [
    products.some((p) => p.category === "Face") ? "Face care" : null,
    products.some((p) => p.category === "Hair") ? "Hair & scalp" : null,
    products.some((p) => p.category === "Body") ? "Body care" : null,
    products.some((product) => /\bspf\b/i.test(product.name))
      ? "Daily SPF"
      : null,
  ].filter((label): label is string => Boolean(label));

  return (
    <main className={styles.main}>
      <HomeHero
        heroImageUrl={heroAsset.blobUrl || heroAsset.localPath}
        heroCategories={heroCategories}
        classes={{
          hero: `${styles.hero} ${editorialStyles.hero}`,
          heroShade: `${styles.heroShade} ${editorialStyles.heroShade}`,
          heroCopy: styles.heroCopy,
          heroKicker: `${styles.heroKicker} ${editorialStyles.heroKicker}`,
          heroDeck: `${styles.heroDeck} ${editorialStyles.heroDeck}`,
          actions: styles.actions,
          primary: `${styles.primary} ${editorialStyles.heroPrimary}`,
          secondary: `${styles.secondary} ${editorialStyles.heroSecondary}`,
          glassCard: styles.glassCard,
          glassFeature: `${styles.glassFeature} ${editorialStyles.heroFeature}`,
          heroMeta: `${styles.heroMeta} ${editorialStyles.heroMeta}`,
        }}
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Find your chapter</p>
            <h2>Choose a concern.</h2>
          </div>
          <Link className="text-link" href="/concerns">
            View all concerns <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.categoryGrid}>
          {concernCards.map((card, index) => (
            <Link className={styles.category} href={card.href} key={card.label}>
              <small>0{index + 1}</small>
              <SafeEditorialImage
                asset={card.asset}
                alt={card.asset.altText}
                sizes="(max-width: 700px) 70vw, (max-width: 1000px) 30vw, 18vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
              <div>
                <span>{card.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        className={`${styles.story} ${editorialStyles.story} editorial-story`}
      >
        <div
          className={`${styles.storyVisual} ${editorialStyles.visual} editorial-story-visual`}
        >
          <SafeEditorialImage
            asset={storyAsset}
            alt={storyAsset.altText}
            sizes="(max-width: 1000px) 92vw, 58vw"
          />
        </div>
        <div
          className={`${styles.storyCopy} ${editorialStyles.copy} editorial-story-copy`}
        >
          <p className={styles.kicker}>Every skin</p>
          <h2>No one palette.</h2>
          <Link
            className={`${styles.storyLink} ${editorialStyles.link}`}
            href="/concerns"
          >
            Explore concerns
          </Link>
        </div>
      </section>

      <section className="discovery-intro">
        <div>
          <p className="eyebrow">The catalogue</p>
          <h2>Products and prices.</h2>
          <div className="market-sources" aria-label="Nigeria stores observed">
            {marketSignals.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.label} <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <div className="signal-list">
          {catalogueSignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      </section>

      <div className={styles.trendsWrap}>
        <Suspense fallback={null}>
          <MarketTrendsSection />
        </Suspense>
      </div>

      <DiscoveryRail
        kicker="Catalogue"
        title="Browse profiles."
        products={editorsEdit}
      />

      <DiscoveryRail
        kicker="Supportive use"
        title="Supportive care."
        products={supportiveRail}
        href="/products?review=supportive"
        linkLabel="View supportive products"
        ariaLabel="Reviewed supportive products"
      />

      <DiscoveryRail
        kicker="Face care"
        title="Browse the category."
        products={faceCare}
        href="/products?category=Face+care"
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
          <Link className={styles.primary} href="/concerns/dark-spots">
            Read the guide
          </Link>
        </div>
        <SafeEditorialImage
          asset={protectionAsset}
          alt={protectionAsset.altText}
          sizes="(max-width: 900px) 80vw, 34vw"
        />
      </section>

      <DiscoveryRail
        kicker="Hair & body"
        title="Browse the category."
        products={hairAndBody}
        href="/products?category=Hair+%26+scalp"
      />

      <DiscoveryRail
        kicker="More profiles"
        title="Keep browsing."
        products={keepBrowsing}
      />

      <section className={styles.consult}>
        <p className={styles.kicker}>Personal guidance</p>
        <h2>Find your routine.</h2>
        <Link className={styles.consultLink} href="/consult">
          Start
        </Link>
      </section>
    </main>
  );
}
