import type { Metadata } from "next";
import { Suspense } from "react";
import { Package } from "lucide-react";
import {
  listCatalogueProducts,
  findCatalogueProduct,
} from "@/lib/catalogue/repository";
import { findBundleStores } from "@/lib/commerce/bundle-finder";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import { BundleFinderClient } from "@/components/commerce/bundle-finder-client";

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ products?: string }>;
}): Promise<Metadata> {
  const { products } = await searchParams;
  const slugs = products?.split(",").filter(Boolean) ?? [];
  const card = staticSocialCard("bundle");
  if (slugs.length >= 2) {
    return publicSocialMetadata(
      {
        ...card,
        title: `Bundle Finder · ${slugs.length} products`,
        description: `Find stores where you can buy all ${slugs.length} products in one shipment and save on delivery fees.`,
      },
      `/bundle?products=${slugs.join(",")}`,
    );
  }
  return publicSocialMetadata(card, "/bundle");
}

export default async function BundlePage({
  searchParams,
}: {
  searchParams: Promise<{ products?: string }>;
}) {
  const { products } = await searchParams;
  const slugs = products?.split(",").filter(Boolean) ?? [];

  const allProducts = await listCatalogueProducts();

  // Resolve the selected products
  const selectedProducts = (
    await Promise.all(slugs.map((slug) => findCatalogueProduct(slug)))
  ).filter((p): p is NonNullable<typeof p> => p != null);

  const validSlugs = selectedProducts.map((p) => p.slug);

  // Compute bundle results server-side
  const result =
    validSlugs.length >= 2
      ? findBundleStores(selectedProducts)
      : { bundles: [], productSlugs: validSlugs, unmatchedProducts: [] };

  return (
    <main className="bundle-page">
      <div className="bundle-hero">
        <Package size={40} strokeWidth={1.5} aria-hidden="true" />
        <h1>Bundle Finder</h1>
        <p>
          Pick products and find stores that stock them all — so you can buy
          them in one shipment and save on delivery fees.
        </p>
      </div>

      <Suspense fallback={<div className="bundle-loading">Loading…</div>}>
        <BundleFinderClient
          allProducts={allProducts}
          initialResult={result}
          initialSlugs={validSlugs}
        />
      </Suspense>
    </main>
  );
}
