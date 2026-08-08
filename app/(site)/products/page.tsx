import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SafeEditorialImage } from "@/components/editorial/safe-editorial-image";
import { CatalogueSearch } from "@/components/products/catalogue-search";
import { CatalogueTransitionTracker } from "@/components/products/catalogue-transition-tracker";
import { CatalogueFilterFeedback } from "@/components/products/filter-feedback-actions";
import { InventoryFilterSheet } from "@/components/products/inventory-filter-sheet";
import { InventoryResults } from "@/components/products/inventory-results";
import {
  DiscoveryRail,
  CatalogueStories,
} from "@/components/products/catalogue-merchandising";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { editorialAsset } from "@/data/editorial";
import {
  buildCataloguePageModel,
  type CataloguePageParams,
} from "@/lib/catalogue/catalogue-page-model";
import {
  catalogueSocialCard,
  publicSocialMetadata,
} from "@/lib/og/social-card";
import styles from "./products.module.css";
import feedbackStyles from "./catalogue-feedback.module.css";

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CataloguePageParams>;
}) {
  const { card, canonicalPath } = catalogueSocialCard(await searchParams);
  return publicSocialMetadata(card, canonicalPath);
}

const heroAsset = editorialAsset("catalogue-hero");
const allSkinAsset = editorialAsset("catalogue-all-skin-story");
const scalpAsset = editorialAsset("catalogue-scalp-story");
const ageAsset = editorialAsset("catalogue-age-story");

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CataloguePageParams>;
}) {
  const params = await searchParams;
  const model = await buildCataloguePageModel(params);
  const { result, market, browse, href } = model;

  return (
    <main className={styles.page}>
      <CatalogueTransitionTracker currentHref={model.currentHref} />
      <div className={styles.heroStage}>
        <section className={styles.hero}>
          <Reveal className={styles.heroCopy} direction="left">
            <p className={styles.kicker}>The catalogue</p>
            <h1>Browse the shelf.</h1>
          </Reveal>
          <Parallax className={styles.heroImage} range={[-20, 20]}>
            <figure>
              <SafeEditorialImage
                asset={heroAsset}
                alt={heroAsset.altText}
                priority
                sizes="(max-width: 760px) calc(100vw - 2rem), 58vw"
              />
              <figcaption>Care that starts with you.</figcaption>
            </figure>
          </Parallax>
        </section>

        <CatalogueSearch
          key={`${market}:${result.filters.q}`}
          defaultValue={result.filters.q}
          clearHref={model.clearSearchHref}
          market={market}
          marketHrefs={model.marketHrefs}
          suggestions={model.searchSuggestions}
        />
        <p className={styles.searchGuidance}>
          Search by product name, brand, or barcode. Browse by category, routine
          step, or concern below.
        </p>
      </div>

      {!model.hasActiveIntent ? (
        <>
          <section className={styles.browse} id="browse">
            <Reveal className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>Browse</p>
                <h2>Your way.</h2>
              </div>
              <div
                className={styles.browseTabs}
                aria-label="Browse catalogue by"
              >
                {(["category", "routine", "concern"] as const).map((mode) => (
                  <Link
                    aria-current={browse === mode ? "page" : undefined}
                    className={browse === mode ? styles.active : ""}
                    href={href(
                      params,
                      {
                        browse: mode,
                        category: null,
                        concern: null,
                        step: null,
                      },
                      "browse",
                    )}
                    key={mode}
                  >
                    {mode}
                  </Link>
                ))}
              </div>
            </Reveal>
            <Stagger className={styles.browseRail} stagger={0.06}>
              {browse === "category"
                ? result.facets.categories
                    .filter(({ count }) => count > 0)
                    .map(({ value: category, count }) => (
                      <StaggerItem key={category}>
                        <Link
                          className={
                            result.filters.category === category
                              ? styles.selected
                              : ""
                          }
                          href={href(
                            params,
                            {
                              category:
                                result.filters.category === category
                                  ? null
                                  : category,
                              concern: null,
                              step: null,
                            },
                            "all-products",
                          )}
                        >
                          <span>{category}</span>
                          <small>
                            {count} {count === 1 ? "product" : "products"}
                          </small>
                        </Link>
                      </StaggerItem>
                    ))
                : null}
              {browse === "routine"
                ? result.facets.steps
                    .filter(({ count }) => count > 0)
                    .map(({ value: step, count }) => (
                      <StaggerItem key={step}>
                        <Link
                          className={
                            result.filters.step === step ? styles.selected : ""
                          }
                          href={href(
                            params,
                            {
                              step: result.filters.step === step ? null : step,
                              category: null,
                              concern: null,
                            },
                            "all-products",
                          )}
                        >
                          <span>{step}</span>
                          <small>
                            {count} {count === 1 ? "product" : "products"}
                          </small>
                        </Link>
                      </StaggerItem>
                    ))
                : null}
              {browse === "concern"
                ? model.approvedConcerns.map((concern) => (
                    <StaggerItem key={concern.slug}>
                      <Link
                        className={
                          result.filters.concern === concern.slug
                            ? styles.selected
                            : ""
                        }
                        href={href(
                          params,
                          {
                            concern:
                              result.filters.concern === concern.slug
                                ? null
                                : concern.slug,
                            category: null,
                            step: null,
                            review: "supportive",
                          },
                          "all-products",
                        )}
                      >
                        <span>{concern.name}</span>
                        <small>{concern.area}</small>
                      </Link>
                    </StaggerItem>
                  ))
                : null}
            </Stagger>
            {browse === "concern" ? (
              <p className={styles.reviewNote}>
                Only approved supportive uses appear here.
              </p>
            ) : null}
          </section>

          <DiscoveryRail
            eyebrow={
              market === "NG" ? "Checked in Nigeria" : "Checked in the US"
            }
            title="Fresh prices near you."
            products={model.recentlyChecked}
            market={market}
            href={href(
              params,
              { review: "reviewed", availability: "priced", sort: "newest" },
              "all-products",
            )}
          />

          <CatalogueStories
            allSkinAsset={allSkinAsset}
            scalpAsset={scalpAsset}
            ageAsset={ageAsset}
          />
        </>
      ) : null}

      <section
        className={`${styles.catalogue} ${feedbackStyles.catalogueState} ${model.appliedFilters.length ? feedbackStyles.filtered : ""}`}
        id="all-products"
      >
        {model.concernGuides.length ? (
          <aside className={styles.concernGuide} aria-label="Concern guidance">
            <div className={styles.concernGuideHeading}>
              <p className={styles.kicker}>Guide first</p>
              <span>
                {result.total
                  ? "Before product profiles."
                  : "The closest match."}
              </span>
            </div>
            <div className={styles.concernGuideRail}>
              {model.concernGuides.map((concern) => (
                <Link href={`/concerns/${concern.slug}`} key={concern.slug}>
                  <span>{concern.name}</span>
                  <small>{concern.summary}</small>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </aside>
        ) : null}
        <Reveal className={styles.catalogueHeading}>
          <div>
            <p className={styles.kicker}>
              {model.hasGuideIntent ? "Product profiles" : "All products"}
            </p>
            <h2 id="catalogue-results-heading" tabIndex={-1}>
              {model.hasGuideIntent
                ? `${result.total.toLocaleString()} ${result.total === 1 ? "profile" : "profiles"}.`
                : `${result.total.toLocaleString()} found.`}
            </h2>
          </div>
          <InventoryFilterSheet
            filters={
              model.hasGuideOnlyConcern
                ? { ...result.filters, concern: "" }
                : result.filters
            }
            facets={result.facets}
            market={market}
            browse={browse}
            total={result.total}
          />
        </Reveal>
        <CatalogueFilterFeedback
          appliedFilters={model.linkedFilters}
          clearHref={model.clearHref}
          currentHref={model.currentHref}
          total={result.total}
        />
        {model.hasGuideIntent && result.items.length ? (
          <p className={styles.reviewNote}>
            Catalogue profiles, not recommendations.
          </p>
        ) : null}
        {result.items.length ? (
          <InventoryResults
            gridClassName={styles.grid}
            initialItems={result.items}
            key={model.continuationKey}
            market={market}
            pageCount={result.pageCount}
            query={model.continuationQuery}
            requestedPage={model.requestedPage}
            total={result.total}
            url={model.currentHref}
          />
        ) : model.researchHandoffHref ? (
          <div className={styles.empty}>
            <h3>Not here yet.</h3>
            <p>Ask us to find “{result.filters.q}”.</p>
            <div className={styles.emptyActions}>
              <Link href={model.researchHandoffHref}>
                Ask us to find it <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                className={styles.emptySecondary}
                href={model.clearSearchHref}
              >
                Clear search
              </Link>
            </div>
          </div>
        ) : model.primaryGuide ? (
          <div className={styles.empty}>
            <h3>Start with the guide.</h3>
            <p>No product profiles are attached to this guide.</p>
            <div className={styles.emptyActions}>
              <Link href={`/concerns/${model.primaryGuide.slug}`}>
                Read {model.primaryGuide.name}{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                className={styles.emptySecondary}
                href={model.clearGuideHref}
              >
                Show all products
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <h3>Nothing exact.</h3>
            <p>Try fewer filters.</p>
            <Link href="/products">Show all products</Link>
          </div>
        )}
      </section>

      <Reveal className={styles.sourceNote} as="aside">
        <div>
          <p className={styles.kicker}>
            {model.externalProductsCount
              ? "Two catalogue sources"
              : "Catalogue context"}
          </p>
          <h2>Know what you see.</h2>
        </div>
        <div>
          <p>Profiles show products and prices.</p>
          <p>Supportive use adds a care review.</p>
          <Link href="/share">
            Worth sharing <ArrowRight size={15} aria-hidden="true" />
          </Link>
          {model.externalProductsCount ? (
            <a
              href="https://world.openbeautyfacts.org/data"
              target="_blank"
              rel="noreferrer"
            >
              Open Beauty Facts · ODbL / CC BY-SA{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </Reveal>
    </main>
  );
}
