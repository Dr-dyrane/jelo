import type { Metadata } from "next";
import { Suspense } from "react";
import {
  listCatalogueProducts,
  findCatalogueProduct,
} from "@/lib/catalogue/repository";
import { findBundleStores } from "@/lib/commerce/bundle-finder";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import { BundleFinderClient } from "@/components/commerce/bundle-finder-client";
import styles from "@/components/commerce/bundle-finder.module.css";

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ products?: string }>;
}): Promise<Metadata> {
  const { products } = await searchParams;
  const slugs = normaliseSlugs(products);
  const card = staticSocialCard("bundle");
  if (slugs.length >= 2) {
    return publicSocialMetadata(
      {
        ...card,
        title: `Bundle Finder · ${slugs.length} products`,
        description: `Compare retailers with exact Nigerian listings for all ${slugs.length} products.`,
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
  const slugs = normaliseSlugs(products);

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
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="bundle-title">
        <div className={styles.heroCopy}>
          <p className="eyebrow">Bundle Finder</p>
          <h1 id="bundle-title">Build one basket.</h1>
          <p className={styles.heroLead}>
            Choose 2–4 products. See the real one-retailer baskets available,
            then request one verified quote.
          </p>
        </div>
      </section>

      <section
        className={styles.workspace}
        aria-labelledby="bundle-builder-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">One retailer</p>
            <h2 id="bundle-builder-title">Choose your products.</h2>
          </div>
          <p>Exact listed prices only. Product totals exclude delivery.</p>
        </div>
        <Suspense
          fallback={<div className={styles.loading}>Loading products…</div>}
        >
          <BundleFinderClient
            allProducts={allProducts}
            initialResult={result}
            initialSlugs={validSlugs}
          />
        </Suspense>
      </section>
    </main>
  );
}

function normaliseSlugs(value?: string) {
  return Array.from(
    new Set(
      value
        ?.split(",")
        .map((slug) => slug.trim())
        .filter(Boolean) ?? [],
    ),
  ).slice(0, 4);
}
