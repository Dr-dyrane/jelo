import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  isMarketFixtureEnabled,
  listMarketFixtureProducts,
  listMarketFixtures,
  MARKET_UNRESOLVED_REQUESTS,
} from "@/lib/markets/fixture";
import styles from "@/components/markets/market-finder.module.css";

export const metadata: Metadata = {
  title: "Market Finder research fixture · JeloCare",
  description:
    "Development-only prototype for testing exact-product market guidance.",
  robots: { index: false, follow: false },
};

export default function MarketsPage() {
  if (!isMarketFixtureEnabled()) notFound();

  const [market] = listMarketFixtures();
  const products = listMarketFixtureProducts();

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="market-finder-title">
        <div className={styles.heroCopy}>
          <span className={styles.prototypeStamp}>
            <ShieldAlert size={16} aria-hidden="true" />
            Development-only research fixture
          </span>
          <h1 id="market-finder-title">Find the product. Then the place.</h1>
          <p className={styles.heroLead}>
            This prototype starts with the exact pack, then separates current
            product evidence from shop identity and directions. It is not live
            market guidance.
          </p>
        </div>
      </section>

      <section
        className={styles.section}
        aria-labelledby="exact-products-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Exact identity first</p>
            <h2 id="exact-products-title">Choose the pack you mean.</h2>
          </div>
          <p>
            The selected product stays visible through results and directions,
            so a nearby sibling or wrong size cannot silently replace it.
          </p>
        </div>

        <div className={styles.productOptions}>
          {products.map((product) => (
            <Link
              className={styles.productOption}
              href={`/markets/${market.slug}?product=${product.slug}`}
              key={product.slug}
            >
              <span className={styles.miniPackshot}>
                {product.image ? (
                  <SafeProductImage
                    src={product.image}
                    alt={`${product.brand} ${product.name}, ${product.size}`}
                  />
                ) : (
                  <span className={styles.miniPackshotMissing}>
                    Reviewed packshot pending
                  </span>
                )}
              </span>
              <span className={styles.miniIdentity}>
                <small>{product.brand}</small>
                <strong>{product.name}</strong>
                <span>{product.size}</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pilot-market-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Pilot market</p>
            <h2 id="pilot-market-title">One bounded place first.</h2>
          </div>
          <p>
            Choose an exact pack above before entering Trade Fair. The fixture
            never supplies a product choice on your behalf.
          </p>
        </div>

        <article className={styles.marketOverview}>
          <div>
            <p className={styles.kicker}>{market.location}</p>
            <h3>{market.name}</h3>
            <p>{market.summary}</p>
          </div>
          <span className={styles.fixtureChip}>Product selection required</span>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="unresolved-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Fail closed</p>
            <h2 id="unresolved-title">Requests that need the exact pack.</h2>
          </div>
          <p>
            These names are preserved as research requests, but no shop result
            appears until brand, variant and size are resolved.
          </p>
        </div>

        <div className={styles.unresolvedGrid}>
          {MARKET_UNRESOLVED_REQUESTS.map((request) => (
            <article className={styles.unresolvedItem} key={request.query}>
              <strong>{request.query}</strong>
              <span>{request.reason} No market route shown.</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
