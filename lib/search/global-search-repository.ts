import "server-only";

import publicCatalogueSearchArtifact from "@/data/public-catalogue-search.json";
import { canonicalBrandName } from "@/data/brand-canonical-names";
import { products } from "@/data/catalogue";
import { concerns } from "@/data/knowledge";
import {
  ingredientSeeds,
  verifiedProductIngredients,
} from "@/data/product-ingredients";
import { nigeriaRetailers } from "@/data/retailers";
import { parsePublicCatalogueSearchArtifact } from "@/lib/catalogue/public-catalogue-search";
import type { GlobalSearchEntry } from "./global-search-index";
import { brandProfileHref } from "@/lib/catalogue/brand-profile";

const categoryRecords = [
  {
    source: "Face",
    label: "Face care",
    href: "/products?category=Face+care#all-products",
  },
  {
    source: "Body",
    label: "Body care",
    href: "/products?category=Body+care#all-products",
  },
  {
    source: "Hair",
    label: "Hair & scalp",
    href: "/products?category=Hair+%26+scalp#all-products",
  },
] as const;

export type GlobalSearchRepository = {
  entries: GlobalSearchEntry[];
  categories: GlobalSearchEntry[];
  starters: GlobalSearchEntry[];
};

function retailerLabel(retailer: (typeof nigeriaRetailers)[number]) {
  if (retailer.reviewStatus === "provisional") return "Provisional source";
  return retailer.kind === "marketplace" ? "Marketplace" : "Direct retailer";
}

export function buildGlobalSearchRepository(): GlobalSearchRepository {
  const publicProducts = parsePublicCatalogueSearchArtifact(
    publicCatalogueSearchArtifact,
  ).products;
  const publicProductSlugs = new Set(products.map((product) => product.slug));
  const productBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  const productEntries: GlobalSearchEntry[] = publicProducts.map((product) => {
    const catalogueProduct = productBySlug.get(product.slug);
    const brand = canonicalBrandName(product.brand);
    return {
      id: `product:${product.slug}`,
      type: "product",
      label: product.name,
      detail: `${brand} · ${product.size} · ${product.category === "Hair" ? "Hair & scalp" : `${product.category} care`}`,
      href: `/products/${product.slug}`,
      keywords: [
        product.brand,
        product.category,
        product.approvedGtin ?? "",
        product.slug,
      ],
      image: catalogueProduct?.image,
      brand,
      size: product.size,
    };
  });

  const guideEntries: GlobalSearchEntry[] = concerns.map((guide) => ({
    id: `guide:${guide.slug}`,
    type: "guide",
    label: guide.name,
    detail: `${guide.area} guide · Reviewed`,
    href: `/concerns/${guide.slug}`,
    keywords: [
      guide.summary,
      ...guide.signals,
      ...guide.ingredients,
      ...guide.productTerms,
    ],
  }));

  const ingredientEntries: GlobalSearchEntry[] = ingredientSeeds
    .filter((ingredient) =>
      Object.entries(verifiedProductIngredients).some(
        ([slug, ingredients]) =>
          publicProductSlugs.has(slug) &&
          ingredients.some((item) => item.ingredientSlug === ingredient.slug),
      ),
    )
    .map((ingredient) => ({
      id: `ingredient:${ingredient.slug}`,
      type: "ingredient",
      label: ingredient.commonName,
      detail: ingredient.summary,
      href: `/ingredients#${ingredient.slug}`,
      keywords: [
        ingredient.inciName,
        ingredient.evidenceGrade,
        ingredient.sensitiveSkinStatus,
      ],
    }));

  const retailerEntries: GlobalSearchEntry[] = nigeriaRetailers.map(
    (retailer) => ({
      id: `retailer:${retailer.name}`,
      type: "retailer",
      label: retailer.name,
      detail: retailerLabel(retailer),
      href: retailer.homepage,
      keywords: [retailer.kind, retailer.reviewStatus, retailer.market],
      external: true,
    }),
  );

  const companies = new Map<string, { label: string; count: number }>();
  for (const product of publicProducts) {
    const label = canonicalBrandName(product.brand);
    const key = label.toLocaleLowerCase("en-NG");
    const current = companies.get(key);
    if (current) current.count += 1;
    else companies.set(key, { label, count: 1 });
  }
  const companyEntries: GlobalSearchEntry[] = [...companies.values()].map(
    (company) => ({
      id: `company:${company.label}`,
      type: "company",
      label: company.label,
      detail: `${company.count} ${company.count === 1 ? "product" : "products"} in the public catalogue`,
      href: brandProfileHref(company.label),
      keywords: ["brand", "company"],
    }),
  );

  const categories: GlobalSearchEntry[] = categoryRecords.map((category) => {
    const count = publicProducts.filter(
      (product) => product.category === category.source,
    ).length;
    return {
      id: `category:${category.source}`,
      type: "category",
      label: category.label,
      detail: `${count} ${count === 1 ? "product" : "products"}`,
      href: category.href,
      keywords: [
        category.source,
        category.source === "Hair" ? "scalp haircare" : "skincare",
      ],
    };
  });

  const entries = [
    ...productEntries,
    ...guideEntries,
    ...ingredientEntries,
    ...retailerEntries,
    ...companyEntries,
    ...categories,
  ];
  const starterIds = [
    "guide:acne-breakouts",
    "guide:sensitive-barrier",
    "guide:dandruff-itchy-scalp",
    "ingredient:niacinamide",
  ];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return {
    entries,
    categories,
    starters: starterIds.flatMap((id) => byId.get(id) ?? []),
  };
}
