import "server-only";

import {
  getReviewedProductCare,
  type ProductCareState,
  type ReviewedProductCare,
} from "@/data/product-care-review";
import {
  getPharmacyCareReviewAttestation,
  type PharmacyCareReviewAttestation,
} from "@/data/product-care-review-attestation";
import type { Offer, Product } from "@/data/products";
import { listProductIngredientsSafe } from "@/lib/clinical/ingredients";
import { getProductPriceTrends } from "@/lib/inventory/price-trends";
import {
  priceTrendOfferSnapshot,
  type ProductPriceTrends,
} from "@/modules/commerce/price-trends";
import {
  buildProductMarketSnapshot,
  type ProductMarketSnapshot,
} from "@/modules/commerce/product-market-snapshot";

export type ProductPanelTab = "buy" | "stores" | "details";

export type ProductCareDecision = {
  state: ProductCareState;
  statusLabel: string;
  summary: string;
  approvedUses: string[];
  evidenceSourceUrls: string[];
  reviewedAt: string | null;
  pharmacyAttestation: PharmacyCareReviewAttestation | null;
  nextAction: {
    label: string;
    href: string;
  };
};

export type ProductPanelData = {
  productSlug: string;
  productName: string;
  offers: Offer[];
  /** Server-owned market snapshot — one source of truth for the entire panel. */
  marketSnapshot?: ProductMarketSnapshot;
  priceTrends?: ProductPriceTrends;
  careDecision: ProductCareDecision;
  careNote: string;
  usage: string;
  ingredients: Array<{
    id: string;
    slug: string;
    label: string;
    sourceUrl?: string;
  }>;
  routine: Array<{ title: string; detail: string }>;
};

export function buildProductCareDecision(
  careReview: ReviewedProductCare | undefined,
  product: Pick<Product, "brand" | "name">,
): ProductCareDecision {
  const state = careReview?.careState ?? "insufficient_data";
  const evidenceSourceUrls = [...(careReview?.evidenceSourceUrls ?? [])];
  const reviewedAt = careReview?.reviewedAt ?? null;
  const pharmacyAttestation = careReview
    ? (getPharmacyCareReviewAttestation(careReview.productSlug) ?? null)
    : null;
  const nextAction = buildProductCareAction(product);

  if (state === "supportive_eligible") {
    return {
      state,
      statusLabel: "Reviewed supportive use",
      summary:
        "JeloCare has reviewed this product for the specific supportive uses listed here. Tell Jelo what you're noticing for an assessment before you add it to your routine.",
      approvedUses: careReview
        ? careReview.approvedUses.map((use) => use.label)
        : [],
      evidenceSourceUrls,
      reviewedAt,
      pharmacyAttestation: null,
      nextAction,
    };
  }

  if (state === "pharmacist_review") {
    if (pharmacyAttestation) {
      return {
        state,
        statusLabel: "Pharmacist-reviewed context",
        summary:
          "A JeloCare pharmacist approved this as reviewed context only, not a direct supportive recommendation. Tell Jelo what you're noticing for an assessment and a safer next step.",
        approvedUses: [],
        evidenceSourceUrls,
        reviewedAt,
        pharmacyAttestation,
        nextAction,
      };
    }

    return {
      state,
      statusLabel: "Pharmacist guidance required",
      summary:
        "This product still needs pharmacist guidance before JeloCare can treat it as supportive care. Tell Jelo what you're noticing for an assessment and a safer next step.",
      approvedUses: [],
      evidenceSourceUrls,
      reviewedAt,
      pharmacyAttestation: null,
      nextAction,
    };
  }

  return {
    state,
    statusLabel: "Supportive use not confirmed",
    summary:
      "We haven't confirmed this exact product for a particular concern or skin type yet. Tell Jelo what you're noticing for an assessment and a safer next step.",
    approvedUses: [],
    evidenceSourceUrls,
    reviewedAt,
    pharmacyAttestation: null,
    nextAction,
  };
}

function buildProductCareAction(product: Pick<Product, "brand" | "name">) {
  const productName = `${product.brand} ${product.name}`.trim();
  const prompt = `I'm considering ${productName}. What I'm noticing is: `;

  return {
    label: "Tell Jelo what I'm noticing",
    href: `/consult?q=${encodeURIComponent(prompt)}`,
  };
}

/**
 * Builds the complete evidence payload used by every product quick panel.
 * Keeping this server-owned prevents the public page and member workspace from
 * drifting on offer freshness, price history, care review, or ingredient safety.
 */
export async function readProductPanelData(
  product: Product,
  now: number | Date = Date.now(),
): Promise<ProductPanelData> {
  const trendSnapshot = product.offers.flatMap((offer) => {
    if (offer.match === "search") return [];

    return (["NG", "US"] as const).flatMap((market) => {
      const snapshot = priceTrendOfferSnapshot(offer, market);
      return snapshot ? [snapshot] : [];
    });
  });

  const [priceTrends, productIngredients] = await Promise.all([
    getProductPriceTrends(product.slug, trendSnapshot),
    listProductIngredientsSafe(product.slug),
  ]);

  const careReview = getReviewedProductCare(product.slug);
  const careDecision = buildProductCareDecision(careReview, product);

  const ingredients = productIngredients.slice(0, 8).map((ingredient) => {
    const concentration =
      ingredient.concentrationPercent == null
        ? ""
        : `${ingredient.concentrationPercent}% `;

    return {
      id: ingredient.id,
      slug: ingredient.slug,
      label: `${concentration}${ingredient.commonName ?? ingredient.inciName}`,
      sourceUrl: ingredient.sourceUrl ?? undefined,
    };
  });

  return {
    productSlug: product.slug,
    productName: product.name,
    offers: product.offers,
    marketSnapshot: buildProductMarketSnapshot(product.offers, now, false),
    priceTrends,
    careDecision,
    careNote: careDecision.summary,
    usage: product.usage,
    ingredients,
    routine: [],
  };
}
