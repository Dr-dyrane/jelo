import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DirectoryTypeahead } from "@/components/directory/directory-typeahead";
import { buildBrandDirectory } from "@/lib/catalogue/brand-profile";
import { listCatalogueProducts } from "@/lib/catalogue/repository";
import { publicSocialMetadata, staticSocialCard } from "@/lib/og/social-card";
import styles from "./brands.module.css";

export const revalidate = 300;

export const metadata: Metadata = publicSocialMetadata(
  staticSocialCard("brands"),
  "/brands",
);

function directoryLetter(name: string) {
  const letter = name
    .normalize("NFKD")
    .replace(/[^A-Za-z]/g, "")
    .at(0);
  return letter?.toUpperCase() ?? "#";
}

export default async function BrandsPage() {
  const catalogue = await listCatalogueProducts();
  const profiles = buildBrandDirectory(catalogue);
  const groups = profiles.reduce<Map<string, typeof profiles>>(
    (result, profile) => {
      const letter = directoryLetter(profile.name);
      result.set(letter, [...(result.get(letter) ?? []), profile]);
      return result;
    },
    new Map(),
  );
  const pricedProducts = profiles.reduce(
    (total, profile) => total + profile.pricedProductCount,
    0,
  );
  const searchItems = profiles.map((profile) => ({
    href: `/brands/${profile.slug}`,
    name: profile.name,
    detail: `${profile.productCount} ${profile.productCount === 1 ? "product" : "products"} · ${profile.categoryCount} ${profile.categoryCount === 1 ? "care area" : "care areas"}`,
    searchText: profile.categoryCounts
      .map(({ category }) => category)
      .join(" "),
  }));

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Brand directory</p>
          <h1>
            Find the <br />
            name first.
          </h1>
          <p>
            Exact products grouped under one canonical brand name. No duplicate
            aliases.
          </p>
        </div>

        <div className={styles.searchEntry}>
          <DirectoryTypeahead
            id="brand-directory-search"
            label="Find a brand"
            placeholder="Search brand names"
            items={searchItems}
          />
        </div>

        <div className={styles.metrics} aria-label="Brand directory summary">
          <span>
            <strong>{profiles.length}</strong>
            <small>brands</small>
          </span>
          <span>
            <strong>{catalogue.length}</strong>
            <small>products</small>
          </span>
          <span>
            <strong>{pricedProducts}</strong>
            <small>freshly priced</small>
          </span>
        </div>
      </section>

      <section
        className={styles.directory}
        aria-labelledby="brand-directory-heading"
      >
        <div className={styles.directoryHeading}>
          <div>
            <p className="eyebrow">A—Z</p>
            <h2 id="brand-directory-heading">Every public brand.</h2>
          </div>
          <p>
            Each page groups the exact products currently published on JeloCare.
            The directory grows with the catalogue.
          </p>
        </div>

        <div className={styles.letterGroups}>
          {[...groups.entries()].map(([letter, brands]) => (
            <section
              className={styles.letterGroup}
              key={letter}
              aria-labelledby={`brands-${letter}`}
            >
              <h3 id={`brands-${letter}`}>{letter}</h3>
              <div>
                {brands.map((brand) => (
                  <Link href={`/brands/${brand.slug}`} key={brand.slug}>
                    <span>
                      <strong>{brand.name}</strong>
                      <small>
                        {brand.productCount}{" "}
                        {brand.productCount === 1 ? "product" : "products"}
                        {" · "}
                        {brand.categoryCount}{" "}
                        {brand.categoryCount === 1 ? "care area" : "care areas"}
                      </small>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
