import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  PackageSearch,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";
import { DirectoryTypeahead } from "@/components/directory/directory-typeahead";
import { ProductCardGrid } from "@/components/products/product-grid";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { productRequestEntryHref } from "@/lib/customer/product-request-entry";
import {
  isMarketFinderPublicReadEnabled,
  marketFinderPublicMarketSlug,
} from "@/lib/markets/activation";
import {
  isMarketFixtureEnabled,
  listMarketFixtureProducts,
  listMarketFixtures,
  MARKET_UNRESOLVED_REQUESTS,
  resolveMarketFixtureProductPackshot,
} from "@/lib/markets/fixture";
import {
  presentMarketFinderMarket,
  presentMarketFinderProduct,
  type MarketSurfaceMarket,
  type MarketSurfaceProduct,
} from "@/lib/markets/presentation";
import { readMarketFinderDirectory } from "@/lib/markets/repository";
import styles from "@/components/markets/market-finder.module.css";

export const metadata: Metadata = {
  title: "Market Finder",
  description: "Find reviewed physical-market records for one exact product.",
  robots: { index: false, follow: false },
};

type LandingModel = {
  market: MarketSurfaceMarket;
  products: MarketSurfaceProduct[];
  preview: boolean;
};

async function readLandingModel(): Promise<LandingModel> {
  if (isMarketFixtureEnabled()) {
    const [market] = listMarketFixtures();
    if (!market) notFound();
    return {
      market,
      products: listMarketFixtureProducts().map((product) => ({
        ...product,
        image: resolveMarketFixtureProductPackshot(product),
      })),
      preview: true,
    };
  }

  const marketSlug = marketFinderPublicMarketSlug();
  if (!isMarketFinderPublicReadEnabled() || !marketSlug) notFound();

  const directory = await readMarketFinderDirectory(marketSlug);
  if (directory.state === "unavailable") {
    throw new Error("Market Finder is temporarily unavailable.");
  }
  if (directory.state !== "current" || directory.products.length === 0) {
    notFound();
  }

  return {
    market: presentMarketFinderMarket(directory.market),
    products: directory.products.map(presentMarketFinderProduct),
    preview: false,
  };
}

export default async function MarketsPage() {
  const { market, products, preview } = await readLandingModel();
  const productItems = products.map((product) => ({
    product: {
      slug: product.slug,
      brand: product.brand,
      name: product.name,
      size: product.size,
      image: product.image,
      imageUnavailableLabel: "Packshot pending",
    },
    href: `/markets/${market.slug}?product=${encodeURIComponent(product.slug)}`,
  }));
  const reviewedPackshots = products.flatMap((product) =>
    product.image ? [{ product, image: product.image }] : [],
  );
  const searchItems = products.map((product) => ({
    href: `/markets/${market.slug}?product=${encodeURIComponent(product.slug)}`,
    name: product.name,
    detail: `${product.brand} · ${product.size}`,
    searchText: `${product.brand} ${product.name} ${product.size}`,
  }));

  return (
    <main className={styles.main}>
      <section className={styles.finderHero} aria-labelledby="market-title">
        <div className={styles.heroCopy}>
          <p className="eyebrow">Physical markets</p>
          <h1 id="market-title">
            Find it.
            <br />
            In person.
          </h1>
          <p className={styles.heroLead}>
            Start with the exact pack. Separate useful leads from places ready
            to visit.
          </p>
          <div className={styles.truthChips} aria-label="Market Finder status">
            <span>
              <MapPin size={15} aria-hidden="true" /> {market.name}
            </span>
            <span>
              {preview ? (
                <ShieldAlert size={15} aria-hidden="true" />
              ) : (
                <ShieldCheck size={15} aria-hidden="true" />
              )}
              {preview ? "Development preview" : "Reviewed pilot"}
            </span>
          </div>
        </div>

        <div
          className={styles.heroStage}
          aria-label={`${products.length} exact ${products.length === 1 ? "product" : "products"} in the ${market.name} pilot`}
        >
          <div className={styles.stageLabel}>
            <span>Pilot market</span>
            <small>
              {market.name} · {market.location}
            </small>
          </div>
          <div className={styles.heroProducts} aria-hidden="true">
            {reviewedPackshots.length ? (
              reviewedPackshots.map(({ product, image }, index) => (
                <span
                  className={
                    index === 0
                      ? styles.heroProductPrimary
                      : styles.heroProductSecondary
                  }
                  key={product.slug}
                >
                  <SafeProductImage
                    src={image}
                    alt=""
                    priority={index === 0}
                    fallback={
                      <span className={styles.heroImageMissing}>
                        <PackageSearch size={32} aria-hidden="true" />
                        <small>Packshot pending</small>
                      </span>
                    }
                  />
                </span>
              ))
            ) : (
              <span className={styles.heroPackshotsPending}>
                <PackageSearch size={58} aria-hidden="true" />
                <small>Exact packshots in review</small>
              </span>
            )}
          </div>
          <div className={styles.heroMetrics}>
            <span>
              <strong>{products.length}</strong>
              <small>
                {products.length === 1 ? "exact pack" : "exact packs"}
              </small>
            </span>
            <span>
              <strong>1</strong>
              <small>pilot market</small>
            </span>
            <span>
              <PackageSearch size={24} aria-hidden="true" />
              <small>{preview ? "research states" : "reviewed records"}</small>
            </span>
          </div>
        </div>
      </section>

      <section
        className={styles.pickerSection}
        aria-labelledby="exact-products-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">01 · Exact product</p>
            <h2 id="exact-products-title">What are you looking for?</h2>
          </div>
          <p>Choose the exact name and size.</p>
        </div>

        <div className={styles.pickerTools}>
          <DirectoryTypeahead
            id="market-product-search"
            label="Find an exact product"
            placeholder="Product, brand or size"
            items={searchItems}
            suggestionLabel="Products with reviewed records"
            resultNoun="exact product"
            emptyLabel="No reviewed record matches that exact product."
            emptyAction={{
              href: "/me/shelf/add?from=market-finder",
              label: "Share the exact pack",
              queryParameter: "request",
            }}
          />
          <div className={styles.marketScope}>
            <span className={styles.marketScopeIcon} aria-hidden="true">
              <MapPin size={22} />
            </span>
            <span>
              <small>Searching</small>
              <strong>{market.name}</strong>
            </span>
            {preview ? (
              <ShieldAlert size={19} aria-label="Research pilot" />
            ) : (
              <ShieldCheck size={19} aria-label="Reviewed pilot" />
            )}
          </div>
        </div>

        <ProductCardGrid items={productItems} />

        {preview ? (
          <details className={styles.identityQueue}>
            <summary>
              <span className={styles.queueIcon} aria-hidden="true">
                <PackageSearch size={21} />
              </span>
              <span>
                <strong>
                  {MARKET_UNRESOLVED_REQUESTS.length} requests still need an
                  exact pack
                </strong>
                <small>Open the identity queue</small>
              </span>
              <ChevronDown
                className={styles.disclosureChevron}
                size={20}
                aria-hidden="true"
              />
            </summary>
            <div className={styles.identityQueueBody}>
              <ul>
                {MARKET_UNRESOLVED_REQUESTS.map((request) => (
                  <li key={request.slug}>
                    <Link href={productRequestEntryHref(request.query)}>
                      <span>
                        <strong>{request.query}</strong>
                        <small>{request.reason}</small>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}
      </section>
    </main>
  );
}
