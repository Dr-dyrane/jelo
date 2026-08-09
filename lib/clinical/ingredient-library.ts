import type { IngredientCard } from "@/components/ingredients/ingredient-explorer";
import {
  ingredientSeeds,
  verifiedProductIngredients,
} from "@/data/product-ingredients";
import type { Product } from "@/data/products";
import { ingredientById } from "@/modules/clinical/core/ingredients";

type IngredientCatalogueProduct = Pick<Product, "slug" | "brand" | "name">;

/**
 * Builds the public ingredient library from reviewed ingredient evidence and
 * the current canonical catalogue. Missing or unpublished products never
 * survive the join, and retailer/product-name prose never creates an
 * ingredient relationship.
 */
export function buildIngredientLibraryCards(
  catalogueProducts: readonly IngredientCatalogueProduct[],
): IngredientCard[] {
  const productBySlug = new Map(
    catalogueProducts.map((product) => [product.slug, product]),
  );

  return ingredientSeeds.flatMap((ingredient) => {
    const knowledge = ingredientById.get(ingredient.slug);
    const evidence = Object.entries(verifiedProductIngredients).flatMap(
      ([productSlug, productIngredients]) => {
        const product = productBySlug.get(productSlug);
        if (!product) return [];

        return productIngredients
          .filter((item) => item.ingredientSlug === ingredient.slug)
          .map((item) => ({ product, evidence: item }));
      },
    );

    if (!evidence.length) return [];

    const sourceByUrl = new Map<string, { title: string; url: string }>();
    for (const item of evidence) {
      sourceByUrl.set(item.evidence.sourceUrl, {
        title: `${item.product.brand} — ${item.product.name}`,
        url: item.evidence.sourceUrl,
      });
    }

    return [
      {
        slug: ingredient.slug,
        name: ingredient.commonName,
        inciName: ingredient.inciName,
        summary: ingredient.summary,
        evidenceGrade: ingredient.evidenceGrade,
        sensitiveSkinStatus: ingredient.sensitiveSkinStatus,
        products: evidence.map(({ product, evidence: productEvidence }) => ({
          slug: product.slug,
          brand: product.brand,
          name: product.name,
          concentrationPercent: productEvidence.concentrationPercent,
          sourceUrl: productEvidence.sourceUrl,
        })),
        family: knowledge?.family,
        concerns: knowledge?.concerns,
        allowedTimes: knowledge?.allowedTimes,
        pregnancyStatus: knowledge?.pregnancy,
        nursingStatus: knowledge?.breastfeeding,
        photosensitivity: knowledge?.photosensitivity,
        irritationRisk: knowledge?.irritationRisk,
        sources: [...sourceByUrl.values()],
        reviewedAt: evidence
          .map((item) => item.evidence.verifiedAt)
          .sort()
          .at(-1),
      },
    ];
  });
}
