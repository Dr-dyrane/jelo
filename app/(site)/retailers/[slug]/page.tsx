import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
} from "lucide-react";
import { notFound } from "next/navigation";
import { SmartBackLink } from "@/components/navigation/smart-back-link";
import { AddToBasketButton } from "@/components/commerce/add-to-basket-button";
import { ProductCardGrid } from "@/components/products/product-grid";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  nigeriaRetailers,
  retailerBySlug,
  retailerSlug,
} from "@/data/retailers";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { publicSocialMetadata, retailerSocialCard } from "@/lib/og/social-card";
import { buildRetailerProfile } from "@/modules/commerce/retailer-profile";
import { buildRetailerProfileEvidenceCopy } from "@/modules/commerce/retailer-evidence-copy";
import styles from "./retailer-profile.module.css";

export const revalidate = 300;

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function generateStaticParams() {
  return nigeriaRetailers.map((retailer) => ({
    slug: retailerSlug(retailer.name),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const retailer = retailerBySlug(slug);
  if (!retailer) return {};
  const catalogue = await listCatalogueProducts();
  const profile = buildRetailerProfile(retailer, catalogue);

  return publicSocialMetadata(
    retailerSocialCard({
      slug,
      name: retailer.name,
      productCount: profile.productCount,
    }),
    `/retailers/${slug}`,
  );
}

function sourceLabel(retailer: NonNullable<ReturnType<typeof retailerBySlug>>) {
  if (retailer.reviewStatus === "provisional") return "Provisional source";
  if (retailer.kind === "marketplace") return "Marketplace";
  return "Direct retailer";
}

export default async function RetailerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ shopping?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const retailer = retailerBySlug(slug);
  if (!retailer) notFound();

  const catalogue = await listCatalogueProducts();
  const profile = buildRetailerProfile(retailer, catalogue);
  const featured = profile.products.slice(0, 3);
  const shopping = query.shopping === "1";
  const exactOfferCount = profile.products.reduce(
    (count, product) => count + product.offers.length,
    0,
  );
  const evidenceCopy = buildRetailerProfileEvidenceCopy(
    retailer,
    exactOfferCount,
  );
  const lastObserved = profile.latestObservedAt
    ? dateFormatter.format(new Date(profile.latestObservedAt))
    : "Awaiting price";
  const identityObserved = evidenceCopy.identityObservedAt
    ? dateFormatter.format(new Date(evidenceCopy.identityObservedAt))
    : null;
  const host = new URL(retailer.homepage).hostname.replace(/^www\./, "");

  return (
    <main className={styles.main}>
      <section
        className={styles.hero}
        data-shopping={shopping ? "true" : "false"}
      >
        <div className={styles.heroCopy}>
          <SmartBackLink className={styles.backLink} fallbackHref="/retailers">
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </SmartBackLink>
          <p className="eyebrow">
            {shopping ? "Now shopping at" : "JeloCare retailer profile"}
          </p>
          <h1>{retailer.name}</h1>
          <p className={styles.note}>
            {shopping
              ? "Keep adding from this store. Your basket stays with one retailer."
              : evidenceCopy.hero}
          </p>
          <div className={styles.heroActions}>
            {shopping ? (
              <>
                <a href="#store-products" className={styles.primaryAction}>
                  Keep shopping <ArrowDown size={17} aria-hidden="true" />
                </a>
                <Link href="/basket" className={styles.secondaryAction}>
                  <ShoppingBag size={17} aria-hidden="true" /> View basket
                </Link>
              </>
            ) : (
              <>
                <a
                  href={retailer.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryAction}
                >
                  Visit retailer <ArrowUpRight size={17} aria-hidden="true" />
                </a>
                <span>{host}</span>
              </>
            )}
          </div>
          {shopping ? null : (
            <div
              className={styles.disclaimerChips}
              role="group"
              aria-label="Retailer price disclosures"
            >
              <span>Prices may change</span>
              <span>Listing ≠ genuine</span>
            </div>
          )}
        </div>

        <div
          className={styles.heroStage}
          role="group"
          aria-label={`${retailer.name} products observed by JeloCare`}
        >
          <div className={styles.stageLabel}>
            <span>
              {shopping ? "Your current store" : sourceLabel(retailer)}
            </span>
            <small>
              {shopping ? "Exact products below" : evidenceCopy.identityLabel}
              {!shopping && identityObserved ? ` · ${identityObserved}` : null}
            </small>
          </div>
          {featured.length ? (
            <div className={styles.productPortraits}>
              {featured.map((product, index) => (
                <span
                  className={styles[`portrait${index + 1}`]}
                  key={product.slug}
                >
                  <SafeProductImage
                    src={product.image}
                    alt={`${product.brand} ${product.name}`}
                    priority={index === 0}
                  />
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.emptyPortrait} aria-hidden="true">
              <span>{retailer.name}</span>
            </div>
          )}
          <div
            className={styles.metrics}
            role="group"
            aria-label="Retailer observation summary"
          >
            <span>
              <strong>{profile.productCount}</strong>
              <small>
                {profile.productCount === 1 ? "product" : "products"}
              </small>
            </span>
            <span>
              <strong>{retailer.trust}</strong>
              <small>source score</small>
            </span>
            <span>
              <strong>{lastObserved}</strong>
              <small>latest observation</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.catalogueSection} id="store-products">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">
              {shopping
                ? `Shopping at ${retailer.name}`
                : "Observed in Nigeria"}
            </p>
            <h2>
              {profile.productCount
                ? shopping
                  ? "Add from this store."
                  : "Products we found."
                : "No current prices."}
            </h2>
          </div>
          <p>
            {profile.productCount
              ? shopping
                ? "Every card below has a current exact listing at your selected store."
                : `Exact listings currently observed at ${retailer.name}.`
              : `No fresh exact-product offer from ${retailer.name} is public yet.`}
          </p>
        </div>

        {profile.productCount ? (
          <ProductCardGrid
            items={profile.products.map((product) => ({
              product,
              footer: (
                <div className={styles.cardActions}>
                  {shopping ? (
                    <AddToBasketButton
                      slug={product.slug}
                      productName={`${product.brand} ${product.name}`}
                      retailers={[{ name: retailer.name, slug }]}
                      iconOnly
                      redirectToStore={false}
                    />
                  ) : null}
                  <a
                    className={styles.storeAction}
                    href={`/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(retailer.name)}`}
                    aria-label={`Open ${product.brand} ${product.name} at ${retailer.name}`}
                  >
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
              ),
            }))}
          />
        ) : (
          <div className={styles.emptyState}>
            <p>
              We publish a product here only after its variant, size, price and
              observation time match.
            </p>
            <Link href="/products">
              Browse all products <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section className={styles.truthSection}>
        <div>
          <p className="eyebrow">Reading this page</p>
          <h2>
            Useful context.
            <br />
            Clear limits.
          </h2>
        </div>
        <dl>
          <div>
            <dt>Retailer</dt>
            <dd>{evidenceCopy.limit}</dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>Brand, variant and size must match.</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>Only fresh, dated Nigerian observations appear.</dd>
          </div>
          <div>
            <dt>Authenticity</dt>
            <dd>A retailer listing is never proof of genuineness.</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
