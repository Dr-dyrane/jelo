import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExactProductAnchor } from "@/components/markets/exact-product-anchor";
import { MarketShopDetail } from "@/components/markets/market-shop-detail";
import {
  findMarketFixture,
  findMarketFixtureShop,
  isMarketFixtureEnabled,
  resolveMarketFixtureProductQuery,
} from "@/lib/markets/fixture";
import styles from "@/components/markets/market-finder.module.css";

type MarketShopPageProps = {
  params: Promise<{ marketSlug: string; shopSlug: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: MarketShopPageProps): Promise<Metadata> {
  if (!isMarketFixtureEnabled()) {
    return {
      title: "Not found · JeloCare",
      robots: { index: false, follow: false },
    };
  }

  const [{ marketSlug, shopSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const product = resolveMarketFixtureProductQuery(query.product);
  const shop = product
    ? findMarketFixtureShop(marketSlug, product.slug, shopSlug)
    : undefined;

  if (!shop || !product) return { robots: { index: false, follow: false } };

  return {
    title: `${shop.name} · Market Finder research fixture`,
    description: `Development-only ${shop.stateLabel.toLowerCase()} record for ${product.brand} ${product.name}, ${product.size}.`,
    robots: { index: false, follow: false },
  };
}

export default async function MarketShopFixturePage({
  params,
  searchParams,
}: MarketShopPageProps) {
  if (!isMarketFixtureEnabled()) notFound();

  const [{ marketSlug, shopSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const product = resolveMarketFixtureProductQuery(query.product);
  const market = findMarketFixture(marketSlug);
  const shop = product
    ? findMarketFixtureShop(marketSlug, product.slug, shopSlug)
    : undefined;

  if (!market || !product || !shop) notFound();

  return (
    <main className={styles.main}>
      <div className={styles.resultsLayout}>
        <ExactProductAnchor product={product} />
        <MarketShopDetail lead={shop} market={market} product={product} />
      </div>
    </main>
  );
}
