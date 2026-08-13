import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { products as staticProducts } from "@/data/catalogue";
import { concerns } from "@/data/knowledge";
import { getReviewedProductCare } from "@/data/product-care-review";
import { isPublishedIntakeProduct } from "@/data/published-intake-products";
import { nigeriaRetailers, retailerSlug } from "@/data/retailers";
import { ProductHeroMotion } from "@/components/products/product-hero-motion";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductQuickPanel } from "@/components/products/product-quick-panel";
import { ProductSizeSelector } from "@/components/products/product-size-selector";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { BuyTogetherSuggestions } from "@/components/commerce/buy-together-suggestions";
import { AddToBasketButton } from "@/components/commerce/add-to-basket-button";
import { resolveCatalogueProductFamily } from "@/lib/catalogue/product-family";
import { brandProfileHref } from "@/lib/catalogue/brand-profile";
import { findRetailerBasketOptions } from "@/lib/commerce/retailer-basket";
import { readProductPanelData } from "@/lib/catalogue/product-panel-model";
import {
  findCatalogueProduct,
  listCatalogueProducts,
} from "@/lib/catalogue/repository";
import { productSocialCard, publicSocialMetadata } from "@/lib/og/social-card";
import {
  productStructuredData,
  serializeJsonLd,
} from "@/modules/commerce/product-structured-data";
import { productMatchesConcern } from "@/modules/concerns/product-matching";

export const revalidate = 3600;

export function generateStaticParams() {
  return staticProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) return {};
  const url = `/products/${product.slug}`;
  return publicSocialMetadata(productSocialCard(product, "product"), url);
}

async function RelatedProducts({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof findCatalogueProduct>>>;
}) {
  const products = await listCatalogueProducts();
  const related = products
    .filter((item) => item.slug !== product.slug)
    .map((item) => ({
      item,
      score:
        (item.category === product.category ? 2 : 0) +
        (item.step === product.step ? 1 : 0),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((result) => result.item);
  if (!related.length) return null;
  return (
    <section className="related-products">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Keep exploring</p>
          <h2>More to browse.</h2>
        </div>
        <Link className="text-link" href="/products">
          View all <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ProductGrid products={related} />
    </section>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await findCatalogueProduct(slug);
  if (!product) notFound();

  const panelData = await readProductPanelData(product);
  const registeredRetailers = new Set(
    nigeriaRetailers.map((retailer) => retailer.name),
  );
  const shoppingRetailers = findRetailerBasketOptions(
    [product],
    new Map([[product.slug, 1]]),
  )
    .filter(
      (option) => option.allInStock && registeredRetailers.has(option.retailer),
    )
    .map((option) => ({
      name: option.retailer,
      slug: retailerSlug(option.retailer),
    }));

  const careReview = getReviewedProductCare(product.slug);
  const productFamily = resolveCatalogueProductFamily(
    product.slug,
    staticProducts,
  );
  const catalogueVerified = isPublishedIntakeProduct(product.slug);
  const careStatus =
    careReview?.careState === "supportive_eligible"
      ? "Supportive use"
      : careReview?.careState === "pharmacist_review"
        ? "Pharmacist review"
        : catalogueVerified
          ? null
          : "Formula review pending";

  const matchedConcerns = concerns.filter((concern) =>
    productMatchesConcern(product, concern),
  );
  const structuredData = productStructuredData(product);

  const marketReading = panelData.marketSnapshot?.NG.reading;
  const pricedReading =
    marketReading?.state === "priced" ? marketReading : null;
  const listingReading =
    marketReading?.state === "listing-only" ? marketReading : null;

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />
      ) : null}
      <main className="product-page">
        <ProductHeroMotion
          brand={product.brand}
          brandHref={brandProfileHref(product.brand)}
          name={product.name}
          size={productFamily ? null : product.size}
          category={product.category}
          step={product.step}
          careStatus={careStatus}
          priceLabel={
            pricedReading
              ? pricedReading.priceLabel
              : listingReading
                ? listingReading.lastKnownPriceLabel
                : null
          }
          lowestPrice={pricedReading?.lowestPrice ?? null}
          storeCount={pricedReading?.storeCount ?? 0}
          sizeSelector={
            productFamily ? (
              <ProductSizeSelector family={productFamily} />
            ) : null
          }
          quickPanel={<ProductQuickPanel {...panelData} />}
          basketAction={
            <AddToBasketButton
              slug={product.slug}
              productName={`${product.brand} ${product.name}`}
              retailers={shoppingRetailers}
            />
          }
          concernLinks={
            matchedConcerns.length ? (
              <div className="product-concern-links">
                {matchedConcerns.map((concern) => (
                  <Link key={concern.slug} href={`/concerns/${concern.slug}`}>
                    {concern.name}
                  </Link>
                ))}
              </div>
            ) : null
          }
          image={
            <SafeProductImage
              src={product.image}
              alt={`${product.brand} ${product.name}`}
              priority
            />
          }
        />

        <Suspense fallback={null}>
          <BuyTogetherSuggestions
            product={product}
            allProducts={staticProducts}
          />
        </Suspense>

        <Suspense fallback={null}>
          <RelatedProducts product={product} />
        </Suspense>
      </main>
    </>
  );
}
