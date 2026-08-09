import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Store } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/products/product-grid";
import { SafeProductImage } from "@/components/products/safe-product-image";
import { products as staticProducts } from "@/data/catalogue";
import {
  brandProfileHref,
  brandSlug,
  buildBrandProfile,
} from "@/lib/catalogue/brand-profile";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { brandSocialCard, publicSocialMetadata } from "@/lib/og/social-card";
import styles from "./brand-profile.module.css";

export const revalidate = 300;

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function generateStaticParams() {
  return [
    ...new Set(staticProducts.map((product) => brandSlug(product.brand))),
  ].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = buildBrandProfile(slug, await listCatalogueProducts());
  if (!profile) return {};
  return publicSocialMetadata(
    brandSocialCard({
      slug,
      name: profile.name,
      productCount: profile.productCount,
      categoryCount: profile.categoryCount,
    }),
    brandProfileHref(profile.name),
  );
}

function categoryLabel(category: "Face" | "Body" | "Hair") {
  if (category === "Hair") return "Hair & scalp";
  return `${category} care`;
}

export default async function BrandProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = buildBrandProfile(slug, await listCatalogueProducts());
  if (!profile) notFound();

  const featured = profile.products.slice(0, 3);
  const latestObserved = profile.latestObservedAt
    ? dateFormatter.format(new Date(profile.latestObservedAt))
    : "No fresh price";
  const catalogueHref = `/products?brand=${encodeURIComponent(profile.name)}#all-products`;

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link className={styles.backLink} href="/products">
            <ArrowLeft size={16} aria-hidden="true" />
            All products
          </Link>
          <p className="eyebrow">JeloCare brand profile</p>
          <h1>{profile.name}</h1>
          <p className={styles.intro}>
            Every exact {profile.name} product currently in the JeloCare
            catalogue—together, with Nigerian price context where available.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#brand-products">
              Explore the range <ArrowRight size={17} aria-hidden="true" />
            </a>
            <Link href={catalogueHref}>Open catalogue filter</Link>
          </div>
          {profile.ownRetailer ? (
            <Link className={styles.roleLink} href={profile.ownRetailer.href}>
              <Store size={16} aria-hidden="true" />
              {profile.ownRetailer.name} also has a retailer profile
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <div
          className={styles.heroStage}
          aria-label={`${profile.name} products in the JeloCare catalogue`}
        >
          <div className={styles.stageCopy}>
            <span>One brand</span>
            <strong>{profile.productCount} exact profiles</strong>
          </div>
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
          <div className={styles.metrics} aria-label="Brand catalogue summary">
            <span>
              <strong>{profile.productCount}</strong>
              <small>
                {profile.productCount === 1 ? "product" : "products"}
              </small>
            </span>
            <span>
              <strong>{profile.categoryCount}</strong>
              <small>
                {profile.categoryCount === 1 ? "care area" : "care areas"}
              </small>
            </span>
            <span>
              <strong>{profile.pricedProductCount}</strong>
              <small>freshly priced</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.rangeSection} aria-labelledby="range-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Across the range</p>
            <h2 id="range-heading">See the shape.</h2>
          </div>
          <p>Grouped by the care area recorded for each exact product.</p>
        </div>
        <div className={styles.categoryRail}>
          {profile.categoryCounts.map(({ category, count }, index) => (
            <article key={category}>
              <span>0{index + 1}</span>
              <strong>{categoryLabel(category)}</strong>
              <small>
                {count} {count === 1 ? "product" : "products"}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section
        className={styles.catalogueSection}
        id="brand-products"
        aria-labelledby="brand-products-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">The catalogue</p>
            <h2 id="brand-products-heading">Every profile.</h2>
          </div>
          <p>
            {profile.productCount} exact {profile.name} product
            {profile.productCount === 1 ? "" : "s"}. Prices remain
            store-specific.
          </p>
        </div>
        <ProductGrid products={profile.products} />
      </section>

      <section className={styles.observedSection}>
        <div>
          <p className="eyebrow">Observed in Nigeria</p>
          <h2>
            Brand here.
            <br />
            Stores there.
          </h2>
          <p>
            A brand profile groups products. Retailer profiles show where fresh,
            exact listings were observed.
          </p>
        </div>
        <div className={styles.retailerList}>
          {profile.retailers.length ? (
            profile.retailers.map((retailer) =>
              retailer.href ? (
                <Link href={retailer.href} key={retailer.name}>
                  <span>{retailer.name}</span>
                  <small>
                    {retailer.productCount}{" "}
                    {retailer.productCount === 1 ? "product" : "products"}
                  </small>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <div key={retailer.name}>
                  <span>{retailer.name}</span>
                  <small>{retailer.productCount} observed</small>
                </div>
              ),
            )
          ) : (
            <p className={styles.emptyRetailers}>
              No fresh exact Nigerian price is public for this brand yet.
            </p>
          )}
          <p className={styles.observedAt}>
            Latest observation · {latestObserved}
          </p>
        </div>
      </section>
    </main>
  );
}
