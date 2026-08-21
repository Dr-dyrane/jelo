"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CircleCheck,
  Plus,
  RotateCcw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import {
  startTransition,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import type { Concern } from "@/data/knowledge";
import type { Product } from "@/data/products";
import { ProductCard } from "@/components/products/product-card";
import {
  buildConcernDirectory,
  concernIsOutsideInitialDirectory,
  INITIAL_CONCERN_DIRECTORY_COUNT,
  type ConcernAreaFilter,
} from "./concern-directory";
import {
  isProductMatchConcern,
  rankProductsForConcerns,
  rankReviewedContextForConcerns,
} from "@/modules/concerns/product-matching";
import styles from "./concern-selector.module.css";
import feedbackStyles from "./concern-feedback.module.css";

function matchedConcernNames(slugs: string[], concerns: Concern[]) {
  return slugs
    .map((slug) => concerns.find((concern) => concern.slug === slug)?.name)
    .filter((name): name is string => Boolean(name));
}

export function ConcernSelector({
  concerns,
  products,
  initialSelected,
}: {
  concerns: Concern[];
  products: Product[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const selectableSlugs = useMemo(
    () =>
      new Set(
        concerns.filter(isProductMatchConcern).map((concern) => concern.slug),
      ),
    [concerns],
  );
  const safeInitialSelected = useMemo(
    () => initialSelected.filter((slug) => selectableSlugs.has(slug)),
    [initialSelected, selectableSlugs],
  );
  const [selected, setSelected] = useOptimistic(safeInitialSelected);
  const [feedback, setFeedback] = useState<{
    message: string;
    previous: string[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<ConcernAreaFilter>("All");
  const [directoryExpanded, setDirectoryExpanded] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const directory = useMemo(
    () =>
      buildConcernDirectory({
        concerns,
        query,
        area,
        expanded: directoryExpanded,
        selectedSlugs: selected,
      }),
    [area, concerns, directoryExpanded, query, selected],
  );
  const { displayedConcerns, visibleConcerns } = directory;

  const careCleared = useMemo(
    () => rankProductsForConcerns(products, concerns, selected),
    [products, concerns, selected],
  );
  const reviewedContext = useMemo(
    () => rankReviewedContextForConcerns(products, concerns, selected),
    [products, concerns, selected],
  );

  function update(next: string[], message: string, previous = selected) {
    const safeNext = next.filter((slug) => selectableSlugs.has(slug));
    const query = new URLSearchParams(window.location.search);
    if (safeNext.length) query.set("concerns", safeNext.join(","));
    else query.delete("concerns");
    const suffix = query.toString();
    startTransition(() => {
      setSelected(safeNext);
      setFeedback({ message, previous: [...previous] });
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, {
        scroll: false,
      });
    });
  }

  function toggle(slug: string) {
    const concern = concerns.find((item) => item.slug === slug);
    const active = selected.includes(slug);
    if (concernIsOutsideInitialDirectory(concerns, slug)) {
      setDirectoryExpanded(true);
    }
    const next = active
      ? selected.filter((item) => item !== slug)
      : [...selected, slug];
    update(
      next,
      `${concern?.name ?? "Concern"} ${active ? "removed" : "selected"}.`,
    );
  }

  function undo() {
    if (!feedback) return;
    update(feedback.previous, "Last change undone.", selected);
  }

  function viewMatches() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultsRef.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <section
        className={styles.selector}
        aria-labelledby="concern-selector-title"
      >
        <div className={styles.selectorHeading}>
          <div>
            <p className="eyebrow">Your edit</p>
            <h2 id="concern-selector-title">Pick yours.</h2>
          </div>
        </div>

        <div className={styles.tools}>
          <label className={styles.search}>
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only">Search concerns and signs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a concern or sign"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear concern search"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div
            className={styles.areaFilters}
            role="group"
            aria-label="Filter concerns by area"
          >
            {(["All", "Face", "Body", "Hair", "Scalp"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={area === item}
                onClick={() => setArea(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.directoryStatus}>
          <p role="status" aria-live="polite">
            <strong>{displayedConcerns.length}</strong>
            {displayedConcerns.length < visibleConcerns.length
              ? ` of ${visibleConcerns.length}`
              : ""}{" "}
            {displayedConcerns.length === 1 ? "guide" : "guides"} shown
          </p>
          <div className={styles.directoryStatusActions}>
            {!query &&
            area === "All" &&
            !directory.hasHiddenSelection &&
            visibleConcerns.length > INITIAL_CONCERN_DIRECTORY_COUNT ? (
              <button
                type="button"
                aria-controls="concern-directory"
                aria-expanded={directoryExpanded}
                onClick={() => setDirectoryExpanded((current) => !current)}
              >
                {directoryExpanded
                  ? `Show first ${INITIAL_CONCERN_DIRECTORY_COUNT}`
                  : `Browse all ${visibleConcerns.length}`}
              </button>
            ) : null}
            {query || area !== "All" ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setArea("All");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {displayedConcerns.length ? (
          <div
            className={styles.rail}
            id="concern-directory"
            aria-label="Select concerns"
          >
            {displayedConcerns.map((concern) => {
              const index = concerns.findIndex(
                (item) => item.slug === concern.slug,
              );
              const active = selected.includes(concern.slug);
              if (!isProductMatchConcern(concern)) {
                return (
                  <article
                    className={`${styles.card} ${styles.guideCard}`}
                    key={concern.slug}
                  >
                    <Link
                      className={styles.guideCardLink}
                      href={`/concerns/${concern.slug}`}
                    >
                      <span className={styles.cardTop}>
                        <small>
                          {String(index + 1).padStart(2, "0")} · {concern.area}{" "}
                          guide
                        </small>
                        <span>
                          <ArrowUpRight size={17} aria-hidden="true" />
                        </span>
                      </span>
                      <strong>{concern.name}</strong>
                      <p>{concern.summary}</p>
                      <span className={styles.guideAction}>
                        Read guide <ArrowUpRight size={14} aria-hidden="true" />
                      </span>
                    </Link>
                  </article>
                );
              }
              return (
                <article
                  className={`${styles.card} ${active ? styles.active : ""}`}
                  key={concern.slug}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(concern.slug)}
                  >
                    <span className={styles.cardTop}>
                      <small>
                        {String(index + 1).padStart(2, "0")} · {concern.area}
                      </small>
                      <span>
                        {active ? (
                          <Check size={17} aria-hidden="true" />
                        ) : (
                          <Plus size={17} aria-hidden="true" />
                        )}
                      </span>
                    </span>
                    <strong>{concern.name}</strong>
                    <p>{concern.summary}</p>
                  </button>
                  <Link
                    className={styles.cardGuideLink}
                    href={`/concerns/${concern.slug}`}
                  >
                    Guide <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.directoryEmpty}>
            <p>No matching guide</p>
            <h3>Try another word.</h3>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setArea("All");
              }}
            >
              Show all concerns
            </button>
          </div>
        )}
        {feedback ? (
          <div
            className={feedbackStyles.feedback}
            role="status"
            aria-live="polite"
          >
            <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <strong>{feedback.message}</strong>
              <span>
                {selected.length} selected · {careCleared.length} care-cleared ·{" "}
                {reviewedContext.length} pharmacist-reviewed
              </span>
            </div>
            <div className={feedbackStyles.actions}>
              {selected.length ? (
                <button type="button" onClick={viewMatches}>
                  View products <ArrowDown size={14} aria-hidden="true" />
                </button>
              ) : null}
              <button type="button" onClick={undo}>
                <Undo2 size={14} aria-hidden="true" /> Undo
              </button>
              {selected.length ? (
                <button
                  type="button"
                  onClick={() => update([], "Selections cleared.")}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {selected.length ? (
        <section
          className={`${styles.results} ${feedbackStyles.results}`}
          ref={resultsRef}
          tabIndex={-1}
        >
          <div className={styles.resultsHeading}>
            <div>
              <p className="eyebrow">Products</p>
              <h2>Your products.</h2>
            </div>
            <button
              type="button"
              onClick={() => update([], "Selections cleared.")}
            >
              <RotateCcw size={15} aria-hidden="true" /> Clear
            </button>
          </div>

          <p className={styles.resultCount}>
            {careCleared.length} care-cleared · {reviewedContext.length}{" "}
            pharmacist-reviewed · {selected.length} selected
          </p>
          <div className={styles.resultTier}>
            <div className={styles.tierHeading}>
              <p className="eyebrow">Care-cleared</p>
              <h3>Direct catalogue matches.</h3>
            </div>
            {careCleared.length ? (
              <div className={styles.productGrid}>
                {careCleared.map((result) => (
                  <div
                    className={styles.productMatch}
                    key={result.product.slug}
                  >
                    <span>
                      Matches{" "}
                      {matchedConcernNames(
                        result.matchedConcernSlugs,
                        concerns,
                      ).join(" · ")}
                    </span>
                    <ProductCard product={result.product} />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No care-cleared product yet.</p>
            )}
          </div>

          {reviewedContext.length ? (
            <div className={styles.reviewedContext}>
              <div className={styles.tierHeading}>
                <p className="eyebrow">Pharmacist review</p>
                <h3>Products connected by reviewed evidence.</h3>
                <p className={styles.tierDescription}>
                  These products are linked to your selected concerns, but they
                  are not direct recommendations. Check suitability with a
                  pharmacist or clinician first.
                </p>
              </div>
              <div className={styles.productGrid}>
                {reviewedContext.map((result) => (
                  <div
                    className={styles.productMatch}
                    key={result.product.slug}
                  >
                    <span>
                      Reviewed for{" "}
                      {matchedConcernNames(
                        result.matchedConcernSlugs,
                        concerns,
                      ).join(" · ")}
                    </span>
                    <ProductCard product={result.product} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
