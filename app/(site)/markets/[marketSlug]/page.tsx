import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExactProductAnchor } from "@/components/markets/exact-product-anchor";
import { MarketResultList } from "@/components/markets/market-result-list";
import {
  deriveMarketPrimaryAction,
  findMarketFixture,
  isMarketFixtureEnabled,
  listMarketFixtureLeads,
  resolveMarketFixtureProductQuery,
} from "@/lib/markets/fixture";
import styles from "@/components/markets/market-finder.module.css";

type MarketPageProps = {
  params: Promise<{ marketSlug: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: MarketPageProps): Promise<Metadata> {
  if (!isMarketFixtureEnabled()) {
    return {
      title: "Not found · JeloCare",
      robots: { index: false, follow: false },
    };
  }

  const [{ marketSlug }, query] = await Promise.all([params, searchParams]);
  const product = resolveMarketFixtureProductQuery(query.product);
  const market = findMarketFixture(marketSlug);

  if (!market || !product) return { robots: { index: false, follow: false } };

  return {
    title: `${product.name} at ${market.name} · research fixture`,
    description: `Development-only exact-product market finder fixture for ${product.brand} ${product.name}, ${product.size}.`,
    robots: { index: false, follow: false },
  };
}

export default async function MarketFixturePage({
  params,
  searchParams,
}: MarketPageProps) {
  if (!isMarketFixtureEnabled()) notFound();

  const [{ marketSlug }, query] = await Promise.all([params, searchParams]);
  const product = resolveMarketFixtureProductQuery(query.product);
  const market = findMarketFixture(marketSlug);

  if (!market || !product) notFound();

  const leads = listMarketFixtureLeads(market.slug, product.slug);
  const readyLeadCount = leads.filter(
    (lead) => deriveMarketPrimaryAction(lead).enabled,
  ).length;
  const researchRecordCount = leads.length - readyLeadCount;

  return (
    <main className={styles.main}>
      <section className={styles.marketHero} aria-labelledby="market-title">
        <Link className={styles.marketBreadcrumb} href="/markets">
          Market Finder research fixture
        </Link>
        <h1 id="market-title">{market.name}</h1>
        <p className={styles.marketLead}>{market.summary}</p>
        <div className={styles.marketMeta} aria-label="Fixture boundaries">
          <span>{market.location}</span>
          <span>List-first</span>
          <span>No GPS required</span>
          <span>Not public guidance</span>
        </div>
      </section>

      <div className={styles.resultsLayout}>
        <ExactProductAnchor product={product} />

        <section
          className={styles.resultsColumn}
          aria-labelledby="lead-results-title"
        >
          <div className={styles.resultsIntro}>
            <div>
              <p className={styles.kicker}>Eligibility before ranking</p>
              <h2 id="lead-results-title">Places ready to try.</h2>
            </div>
            <p>
              {readyLeadCount} reviewed place{" "}
              {readyLeadCount === 1 ? "lead" : "leads"}. {researchRecordCount}{" "}
              research {researchRecordCount === 1 ? "record is" : "records are"}{" "}
              kept below, outside the ranked list.
            </p>
          </div>

          <MarketResultList
            leads={leads}
            marketSlug={market.slug}
            product={product}
          />
        </section>
      </div>
    </main>
  );
}
