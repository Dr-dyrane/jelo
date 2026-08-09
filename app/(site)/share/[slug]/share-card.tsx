import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ShareSignal } from "@/modules/commerce/share-insights";
import styles from "./share-card.module.css";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export type SharePriceTrend = {
  label: string;
  description: string;
  direction: "down" | "up";
};

export type ShareOffer = {
  retailer: string;
  priceLabel: string;
  goHref: string;
  when: string;
  isLowest: boolean;
  isMarketplace: boolean;
  trend: SharePriceTrend | null;
};

export type ShareView = {
  productSlug: string;
  brand: string;
  name: string;
  size: string;
  category: "Face" | "Hair" | "Body";
  microtag: string;
  image: string;
  observedDate: string;
  spreadLabel: string | null;
  storeCount: number;
  marketTrend: SharePriceTrend | null;
  offers: ShareOffer[];
};

function PriceTrend({
  trend,
  market = false,
}: {
  trend: SharePriceTrend | null;
  market?: boolean;
}) {
  if (!trend) return null;
  return (
    <span
      className={`${styles.trend} ${trend.direction === "down" ? styles.trendDown : styles.trendUp}`}
      aria-label={trend.description}
      title={trend.description}
    >
      {market ? <span className={styles.trendSubject}>Market</span> : null}
      {trend.label}
    </span>
  );
}

export function ShareCard({ view }: { view: ShareView }) {
  const productHref = `/products/${view.productSlug}`;
  return (
    <div className={styles.card}>
      <span className={styles.tag}>
        Observed in Nigeria · {view.observedDate}
      </span>
      <Link
        href={productHref}
        className={styles.shot}
        aria-label={`${view.brand} ${view.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.image} alt={`${view.brand} ${view.name}`} />
      </Link>
      <div className={styles.brand}>{view.brand}</div>
      <Link
        href={productHref}
        className={styles.name}
        style={{ display: "block" }}
      >
        {view.name}
      </Link>
      <div className={styles.microtag}>{view.microtag}</div>

      {view.spreadLabel ? (
        <div className={styles.spread}>
          <span className={styles.spreadValue}>
            <b>{view.spreadLabel}</b>
            <PriceTrend trend={view.marketTrend} market />
          </span>
          <span>
            <strong>Lowest</strong> to <strong>highest</strong>.
          </span>
        </div>
      ) : null}

      <div className={styles.offers}>
        {view.offers.map((offer) => (
          <div className={styles.offer} key={offer.retailer}>
            <div className={styles.store}>
              <span
                className={`${styles.dot} ${offer.isLowest ? styles.low : ""}`}
              />
              {offer.retailer}
            </div>
            <div className={styles.price}>
              <span>{offer.priceLabel}</span>
              <PriceTrend trend={offer.trend} />
            </div>
            <div className={styles.meta}>
              {offer.isLowest ? (
                <span className={`${styles.label} ${styles.low}`}>
                  Lowest observed
                </span>
              ) : null}
              {offer.isMarketplace ? (
                <span className={`${styles.label} ${styles.mkt}`}>
                  Marketplace
                </span>
              ) : null}
              <span className={styles.when}>{offer.when}</span>
            </div>
            <a
              className={styles.go}
              href={offer.goHref}
              target="_blank"
              rel="noopener nofollow"
              aria-label={`Open ${offer.retailer} store`}
            >
              Open store ↗
            </a>
          </div>
        ))}
      </div>

      <p className={styles.fine}>
        <strong>
          Lowest of {view.storeCount}{" "}
          {view.storeCount === 1 ? "store" : "stores"}.
        </strong>{" "}
        Prices may change · Listing ≠ genuine
      </p>
    </div>
  );
}

export function ShareAlternatives({ items }: { items: ShareSignal[] }) {
  if (items.length === 0) return null;

  return (
    <section
      className={styles.alternatives}
      aria-labelledby="more-worth-sharing"
    >
      <header className={styles.alternativesHead}>
        <span>Worth sharing</span>
        <h2 id="more-worth-sharing">More to pass on.</h2>
      </header>
      <ul
        className={styles.alternativeList}
        data-count={Math.min(items.length, 3)}
      >
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/share/${item.slug}`}
              className={styles.alternativeCard}
            >
              <span className={styles.alternativeShot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={`${item.brand} ${item.name}`}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className={styles.alternativeBody}>
                <span className={styles.alternativeBrand}>{item.brand}</span>
                <strong>{item.name}</strong>
                <span className={styles.alternativeMeta}>{item.microtag}</span>
                <span className={styles.alternativePrice}>
                  {item.storeCount > 1 ? "From" : "Observed"}{" "}
                  {naira.format(item.lowestNaira)} · {item.storeCount}{" "}
                  {item.storeCount === 1 ? "store" : "stores"}
                </span>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
