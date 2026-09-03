import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  PackageSearch,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { ExactProductAnchor } from "@/components/markets/exact-product-anchor";
import {
  MarketResultList,
  type MarketResultLead,
} from "@/components/markets/market-result-list";
import { SmartBackLink } from "@/components/navigation/smart-back-link";
import { productRequestEntryHref } from "@/lib/customer/product-request-entry";
import {
  isMarketFinderPublicMarketAllowed,
  isMarketFinderPublicReadEnabled,
} from "@/lib/markets/activation";
import { deriveMarketPrimaryAction } from "@/lib/markets/action";
import type { MarketFinderReadModel } from "@/lib/markets/domain";
import {
  findMarketFixture,
  findMarketUnresolvedRequest,
  isMarketFixtureEnabled,
  listMarketFixtureLeads,
  resolveMarketFixtureProductPackshot,
  resolveMarketFixtureProductQuery,
} from "@/lib/markets/fixture";
import {
  presentMarketFinderLocation,
  presentMarketFinderMarket,
  presentMarketFinderProduct,
  presentMarketFinderResearchRecord,
  type MarketSurfaceMarket,
  type MarketSurfaceProduct,
} from "@/lib/markets/presentation";
import { readMarketFinder } from "@/lib/markets/repository";
import styles from "@/components/markets/market-finder.module.css";

type MarketPageProps = {
  params: Promise<{ marketSlug: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
};

type ResultViewModel = {
  market: MarketSurfaceMarket;
  product: MarketSurfaceProduct;
  leads: readonly MarketResultLead[];
  preview: boolean;
  state: MarketFinderReadModel["state"] | "fixture";
};

function resultStateLabel(view: ResultViewModel): string {
  if (view.preview) return "Development preview";
  if (view.state === "current") return "Current observation";
  if (view.state === "stale") return "Evidence expired";
  if (view.state === "disputed") return "Location under review";
  if (view.state === "unavailable") return "No visit action";
  return "No confirmed place";
}

async function readResultViewModel(
  marketSlug: string,
  productQuery: string | string[] | undefined,
): Promise<ResultViewModel | null> {
  if (isMarketFixtureEnabled()) {
    const product = resolveMarketFixtureProductQuery(productQuery);
    const market = findMarketFixture(marketSlug);
    if (!market || !product) return null;
    return {
      market,
      product: {
        ...product,
        image: resolveMarketFixtureProductPackshot(product),
      },
      leads: listMarketFixtureLeads(market.slug, product.slug).map((lead) => ({
        ...lead,
        detailRecordAvailable: lead.kind === "shop",
      })),
      preview: true,
      state: "fixture",
    };
  }

  if (
    !isMarketFinderPublicReadEnabled() ||
    !isMarketFinderPublicMarketAllowed(marketSlug) ||
    typeof productQuery !== "string"
  ) {
    return null;
  }

  const model = await readMarketFinder({
    marketSlug,
    productSlug: productQuery,
  });
  if (
    model.state === "unavailable" &&
    model.reason === "repository-unavailable"
  ) {
    throw new Error("Market Finder is temporarily unavailable.");
  }
  if (!model.context) return null;

  return {
    market: presentMarketFinderMarket(model.context.market),
    product: presentMarketFinderProduct(model.context.product),
    leads: [
      ...(model.state === "current"
        ? model.locations.map((location) =>
            presentMarketFinderLocation(model.context, location),
          )
        : []),
      ...model.researchRecords.map((record) =>
        presentMarketFinderResearchRecord(model.context!, record),
      ),
    ],
    preview: false,
    state: model.state,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: MarketPageProps): Promise<Metadata> {
  const [{ marketSlug }, query] = await Promise.all([params, searchParams]);
  const view = await readResultViewModel(marketSlug, query.product);
  if (!view) return { robots: { index: false, follow: false } };

  return {
    title: `${view.product.name} at ${view.market.name}`,
    description: `Reviewed physical-market guidance for ${view.product.brand} ${view.product.name}, ${view.product.size}.`,
    robots: { index: false, follow: false },
  };
}

function UnresolvedFixtureProduct({
  marketSlug,
  productSlug,
}: {
  marketSlug: string;
  productSlug: string;
}) {
  const market = findMarketFixture(marketSlug);
  const request = findMarketUnresolvedRequest(productSlug);
  if (!market || !request) notFound();

  return (
    <main className={styles.main}>
      <section className={styles.routeState}>
        <div className={styles.routeStatePanel}>
          <PackageSearch size={28} aria-hidden="true" />
          <p className={styles.kicker}>Exact pack needed</p>
          <h1>{request.query}</h1>
          <p>{request.reason}</p>
          <div className={styles.routeStateActions}>
            <Link
              className={styles.routeStatePrimary}
              href={productRequestEntryHref(request.query)}
            >
              Share the exact pack <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              className={styles.routeStateSecondary}
              href="/markets#exact-products-title"
            >
              Choose another
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function MarketPage({
  params,
  searchParams,
}: MarketPageProps) {
  const [{ marketSlug }, query] = await Promise.all([params, searchParams]);
  const view = await readResultViewModel(marketSlug, query.product);

  if (!view) {
    if (isMarketFixtureEnabled() && typeof query.product === "string") {
      return (
        <UnresolvedFixtureProduct
          marketSlug={marketSlug}
          productSlug={query.product}
        />
      );
    }
    notFound();
  }

  const readyLeadCount = view.leads.filter(
    (lead) => deriveMarketPrimaryAction(lead).enabled,
  ).length;

  return (
    <main className={styles.main}>
      <section className={styles.resultHero} aria-labelledby="market-title">
        <div className={styles.resultHeroCopy}>
          <SmartBackLink className={styles.backLink} fallbackHref="/markets">
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </SmartBackLink>
          <p className="eyebrow">{view.market.location}</p>
          <h1 id="market-title">{view.market.name}</h1>
          <p className={styles.heroLead}>
            {readyLeadCount
              ? `${readyLeadCount} ${readyLeadCount === 1 ? "place is" : "places are"} ready for this exact pack.`
              : "No place is ready for this exact pack yet."}
          </p>
          <div
            className={styles.truthChips}
            role="group"
            aria-label="Result status"
          >
            <span>
              <MapPin size={15} aria-hidden="true" /> Physical market
            </span>
            {readyLeadCount ? (
              <span>
                <ShieldCheck size={15} aria-hidden="true" /> Reviewed before
                travel
              </span>
            ) : null}
            <span>
              {view.preview ? (
                <ShieldAlert size={15} aria-hidden="true" />
              ) : (
                <ShieldCheck size={15} aria-hidden="true" />
              )}
              {resultStateLabel(view)}
            </span>
          </div>
        </div>

        <ExactProductAnchor product={view.product} />
      </section>

      <section
        className={styles.resultsSection}
        aria-labelledby="lead-results-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">02 · Place</p>
            <h2 id="lead-results-title">
              {readyLeadCount ? "Where to go." : "Nothing ready."}
            </h2>
          </div>
          <p>
            {readyLeadCount
              ? "The strongest current route appears first."
              : "Choose another product or check back after review."}
          </p>
        </div>

        <MarketResultList
          leads={view.leads}
          marketSlug={view.market.slug}
          product={view.product}
        />
      </section>
    </main>
  );
}
