import { products as publicProducts } from "@/data/catalogue";
import { catalogueIntakeCandidates } from "@/data/catalogue-intake";
import { catalogueGtinForIdentity } from "@/lib/catalogue/canonical-identity";
import type { KnownCatalogueIdentity } from "@/lib/catalogue/research-priority";

function compactUnique(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  );
}

function exactOfferReferences(
  offers: ReadonlyArray<{
    retailer: string;
    url?: string;
    listingUrl?: string;
    match?: "exact" | "search";
  }>,
) {
  const seen = new Set<string>();
  return offers.flatMap((offer) => {
    if (offer.match === "search") return [];
    const listingUrl = offer.listingUrl ?? offer.url;
    if (!listingUrl) return [];
    const key = `${offer.retailer}\n${listingUrl}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ retailer: offer.retailer, listingUrl }];
  });
}

const intakeById = new Map(
  catalogueIntakeCandidates.map((candidate) => [candidate.id, candidate]),
);

/**
 * The public catalogue is the canonical known-product set. Intake identities
 * only augment aliases/GTINs and contribute the one still-private reviewed
 * identity, so a discovery lead cannot invent a public product binding.
 */
export const catalogueResearchKnownIdentities: KnownCatalogueIdentity[] =
  publicProducts.map((product) => {
    const candidate = intakeById.get(product.slug);
    return {
      productRef: product.slug,
      catalogueStatus: "public-catalogue",
      category: product.category,
      brand: product.brand,
      ...(candidate?.brandAliases?.length
        ? { brandAliases: candidate.brandAliases }
        : {}),
      name: product.name,
      nameAliases: compactUnique([
        candidate?.variant,
        ...(candidate?.nigeria.exactOffers.map(
          (offer) => offer.observedTitle,
        ) ?? []),
      ]),
      size: product.size,
      sizeAliases: compactUnique(
        candidate?.nigeria.exactOffers.map((offer) => offer.observedSize) ?? [],
      ),
      ...(candidate
        ? { gtin: catalogueGtinForIdentity(candidate.identity) }
        : {}),
      offers: exactOfferReferences([
        ...product.offers,
        ...(candidate?.nigeria.exactOffers ?? []),
      ]),
    };
  });

const publicRefs = new Set(
  catalogueResearchKnownIdentities.map((identity) => identity.productRef),
);
for (const candidate of catalogueIntakeCandidates) {
  if (publicRefs.has(candidate.id)) continue;
  catalogueResearchKnownIdentities.push({
    productRef: candidate.id,
    catalogueStatus: "private-intake",
    category:
      candidate.category === "Face care"
        ? "Face"
        : candidate.category === "Hair & scalp"
          ? "Hair"
          : "Body",
    brand: candidate.brand,
    ...(candidate.brandAliases?.length
      ? { brandAliases: candidate.brandAliases }
      : {}),
    name: candidate.name,
    nameAliases: compactUnique([
      candidate.variant,
      ...candidate.nigeria.exactOffers.map((offer) => offer.observedTitle),
    ]),
    size: candidate.size,
    sizeAliases: compactUnique(
      candidate.nigeria.exactOffers.map((offer) => offer.observedSize),
    ),
    gtin: catalogueGtinForIdentity(candidate.identity),
    offers: exactOfferReferences(candidate.nigeria.exactOffers),
  });
}
