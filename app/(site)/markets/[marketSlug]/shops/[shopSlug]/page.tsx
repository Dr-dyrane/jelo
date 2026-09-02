import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketShopDetail } from "@/components/markets/market-shop-detail";
import {
  isMarketFinderPublicMarketAllowed,
  isMarketFinderPublicReadEnabled,
  isMarketFinderReportIntakeEnabled,
} from "@/lib/markets/activation";
import {
  findMarketFixture,
  findMarketFixtureShop,
  isMarketFixtureEnabled,
  resolveMarketFixtureProductPackshot,
  resolveMarketFixtureProductQuery,
} from "@/lib/markets/fixture";
import {
  presentMarketFinderLocation,
  presentMarketFinderMarket,
  presentMarketFinderProduct,
  type MarketSurfaceLead,
  type MarketSurfaceMarket,
  type MarketSurfaceProduct,
} from "@/lib/markets/presentation";
import { readMarketFinder } from "@/lib/markets/repository";
import type { MarketResultLead } from "@/components/markets/market-result-list";
import styles from "@/components/markets/market-finder.module.css";

type MarketShopPageProps = {
  params: Promise<{ marketSlug: string; shopSlug: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
};

type ShopViewModel = {
  market: MarketSurfaceMarket;
  product: MarketSurfaceProduct;
  lead: MarketResultLead & {
    stateLabel: string;
    externalAction?: MarketSurfaceLead["externalAction"];
  };
  preview: boolean;
  reportingEnabled: boolean;
};

async function readShopViewModel(
  marketSlug: string,
  shopSlug: string,
  productQuery: string | string[] | undefined,
): Promise<ShopViewModel | null> {
  if (isMarketFixtureEnabled()) {
    const product = resolveMarketFixtureProductQuery(productQuery);
    const market = findMarketFixture(marketSlug);
    const shop = product
      ? findMarketFixtureShop(marketSlug, product.slug, shopSlug)
      : undefined;
    if (!market || !product || !shop) return null;
    return {
      market,
      product: {
        ...product,
        image: resolveMarketFixtureProductPackshot(product),
      },
      lead: shop,
      preview: true,
      reportingEnabled: true,
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
  if (model.state !== "current") return null;
  const location = model.locations.find((item) => item.slug === shopSlug);
  if (!location) return null;

  return {
    market: presentMarketFinderMarket(model.context.market),
    product: presentMarketFinderProduct(model.context.product),
    lead: presentMarketFinderLocation(model.context, location),
    preview: false,
    reportingEnabled: isMarketFinderReportIntakeEnabled(),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: MarketShopPageProps): Promise<Metadata> {
  const [{ marketSlug, shopSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const view = await readShopViewModel(marketSlug, shopSlug, query.product);
  if (!view) return { robots: { index: false, follow: false } };

  return {
    title: `${view.lead.name} · Market Finder`,
    description: `${view.lead.stateLabel} for ${view.product.brand} ${view.product.name}, ${view.product.size}.`,
    robots: { index: false, follow: false },
  };
}

export default async function MarketShopPage({
  params,
  searchParams,
}: MarketShopPageProps) {
  const [{ marketSlug, shopSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const view = await readShopViewModel(marketSlug, shopSlug, query.product);
  if (!view) notFound();

  return (
    <main className={`${styles.main} ${styles.shopPage}`}>
      <MarketShopDetail
        lead={view.lead}
        market={view.market}
        product={view.product}
        preview={view.preview}
        reportingEnabled={view.reportingEnabled}
      />
    </main>
  );
}
