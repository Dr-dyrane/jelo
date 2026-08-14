import { findCatalogueProduct } from "@/lib/catalogue/repository";
import { getProductPriceTrends } from "@/lib/inventory/price-trends";
import { summarizeMarket } from "@/modules/commerce/market-summary";
import {
  compactPriceMovementLabel,
  describePriceMovement,
  priceTrendOfferSnapshot,
  preferredPriceMovement,
  selectRetailerPriceMovement,
  type PriceMovement,
} from "@/modules/commerce/price-trends";
import { isTrendEligibleNgOffer } from "@/modules/commerce/shareable-offer";
import { selectRepresentativeOffers } from "@/modules/commerce/representative-offers";
import { formatCampaignProductSize } from "@/lib/share/campaign-story";
import { observedStockLabel } from "@/modules/commerce/offer-evidence";
import { isOfferFresh } from "@/modules/commerce/offer-freshness";
import type { ShareOffer, SharePriceTrend, ShareView } from "./share-card";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export type ShareData = {
  view: ShareView;
  headlineLead: string;
  headlineEmph: string | null;
  storeCount: number;
};

function sharePriceTrend(
  movement: PriceMovement | null,
  subject: string,
  minimumComparableRetailers = 1,
): SharePriceTrend | null {
  const label = compactPriceMovementLabel(movement);
  if (
    !movement ||
    !label ||
    movement.direction === "flat" ||
    (movement.comparableRetailerCount ?? 0) < minimumComparableRetailers
  )
    return null;
  return {
    label,
    description: describePriceMovement(movement, subject),
    direction: movement.direction,
  };
}

/**
 * Builds the share view from the same verified offer data the product page uses:
 * fresh, exact, evidence-bound Nigerian offers only. Returns null when a product
 * cannot make an honest price card, so a share page never invents a number.
 */
export async function buildShareData(slug: string): Promise<ShareData | null> {
  const product = await findCatalogueProduct(slug);
  if (!product) return null;

  const now = Date.now();
  const offers = product.offers
    .filter((offer) => isTrendEligibleNgOffer(offer))
    .sort((a, b) => (a.priceNgn as number) - (b.priceNgn as number));
  if (offers.length === 0) return null;

  const summary = summarizeMarket(product.offers, "NG", now);
  const priceTrends = await getProductPriceTrends(
    product.slug,
    offers.flatMap((offer) => {
      const snapshot = priceTrendOfferSnapshot(offer, "NG", now, false);
      return snapshot ? [snapshot] : [];
    }),
  );
  const marketTrend = sharePriceTrend(
    preferredPriceMovement(
      priceTrends.NG,
      (movement) =>
        movement.direction !== "flat" &&
        (movement.comparableRetailerCount ?? 0) >= 2,
    ),
    "Market price",
    2,
  );
  const lowest = offers[0].priceNgn as number;
  const highest = offers[offers.length - 1].priceNgn as number;
  const spread = offers.length >= 2 ? highest - lowest : null;
  const observedIso =
    summary.lastCheckedAt ??
    offers[0].checkedAt ??
    offers[0].priceObservation?.observedAt;
  const observedDate = observedIso
    ? shortDate.format(new Date(observedIso))
    : "recently";

  // A verified product can carry 20-30+ Nigerian offers. Render a small,
  // representative set — lowest, typical (median floor), and highest — so
  // the card stays readable without ever inventing a price.
  const representative = selectRepresentativeOffers(
    offers,
    (offer) => offer.priceNgn as number,
  );
  const representativeOffers = representative?.unique ?? [];

  const shareOffers: ShareOffer[] = representativeOffers.map((offer) => {
    const fresh = isOfferFresh(offer, now);
    const stockLabel = observedStockLabel(offer, fresh);
    const observedAtIso =
      offer.priceObservation?.observedAt ??
      offer.listingEvidence?.observedAt ??
      offer.checkedAt;
    const dateLabel = observedAtIso
      ? shortDate.format(new Date(observedAtIso))
      : observedDate;
    const isLowest = offer === representative?.lowest;
    const isHighest = offer === representative?.highest;
    return {
      retailer: offer.retailer,
      priceLabel: naira.format(offer.priceNgn as number),
      goHref: `/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`,
      when: stockLabel ? `${stockLabel} · ${dateLabel}` : dateLabel,
      observedAt: observedAtIso ?? null,
      isLowest,
      isTypical: offer === representative?.median && !isLowest && !isHighest,
      isMarketplace: Boolean(offer.orderChannels?.includes("marketplace")),
      trend: sharePriceTrend(
        selectRetailerPriceMovement(priceTrends, "NG", offer.retailer),
        `${offer.retailer} price`,
      ),
    };
  });

  const displaySize = formatCampaignProductSize(product.slug, product.size);
  const view: ShareView = {
    productSlug: product.slug,
    brand: product.brand,
    name: product.name,
    size: displaySize,
    category: product.category,
    microtag: `${displaySize} · ${product.category}`,
    image: product.image,
    observedDate,
    observedAt: observedIso ?? null,
    spreadLabel: spread != null ? naira.format(spread) : null,
    storeCount: offers.length,
    marketTrend,
    offers: shareOffers,
  };

  return {
    view,
    headlineLead:
      spread != null ? "Same product." : `${product.brand} ${product.name}`,
    headlineEmph: spread != null ? `${naira.format(spread)} apart.` : null,
    storeCount: offers.length,
  };
}
