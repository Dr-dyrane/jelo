"use client";

import { ArrowRight, ArrowUpRight, Clock3, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SafeProductImage } from "@/components/products/safe-product-image";
import {
  globalSearchTypeLabels,
  globalSearchTypes,
  searchGlobalIndex,
  type GlobalSearchEntry,
  type GlobalSearchFilter,
} from "@/lib/search/global-search-index";
import {
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearch,
} from "@/lib/search/recent-searches";
import styles from "@/app/(site)/search/search.module.css";

type GlobalSearchExperienceProps = {
  entries: GlobalSearchEntry[];
  categories: GlobalSearchEntry[];
  starters: GlobalSearchEntry[];
  initialQuery: string;
  initialFilter: GlobalSearchFilter;
};

const resultOrder = [
  "product",
  "guide",
  "ingredient",
  "company",
  "retailer",
  "category",
] as const;

/** Debounce delay for URL sync during live typing (ms). */
const URL_SYNC_DEBOUNCE_MS = 350;

function resultLabel(type: GlobalSearchEntry["type"]) {
  return globalSearchTypeLabels[type];
}

export function GlobalSearchExperience({
  entries,
  categories,
  starters,
  initialQuery,
  initialFilter,
}: GlobalSearchExperienceProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<GlobalSearchFilter>(initialFilter);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecent(readRecentSearches(window.localStorage));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const focusSearch = () => inputRef.current?.focus();
    window.addEventListener("jelocare:focus-global-search", focusSearch);
    return () =>
      window.removeEventListener("jelocare:focus-global-search", focusSearch);
  }, []);

  // Live search — results update as the user types. The search is entirely
  // client-side against an in-memory index (~200 entries), so this is fast
  // enough to run on every keystroke without debouncing the computation.
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => searchGlobalIndex(entries, trimmedQuery, filter),
    [entries, filter, trimmedQuery],
  );
  const groupedResults = useMemo(
    () =>
      resultOrder.flatMap((type) => {
        const matches = results.filter((result) => result.type === type);
        return matches.length ? [{ type, matches }] : [];
      }),
    [results],
  );
  const isResultsPhase = Boolean(trimmedQuery);

  // Debounced URL sync — keeps the URL shareable and the back button working
  // without pushing a new history entry on every keystroke. Uses replace()
  // so typing doesn't flood browser history; explicit submit uses push()
  // to create a back-button entry.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmedQuery) params.set("q", trimmedQuery);
      if (filter !== "all") params.set("type", filter);
      const nextUrl = params.size ? `/search?${params}` : "/search";
      router.replace(nextUrl, { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [trimmedQuery, filter, router]);

  function submitSearch(value = query) {
    const next = value.trim();
    if (!next) {
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    setQuery(next);
    if (searchGlobalIndex(entries, next, filter).length) {
      setRecent(recordRecentSearch(window.localStorage, next));
    }
    // Immediate URL push on explicit submit so the back button returns to
    // the results page rather than the previous debounced state.
    const params = new URLSearchParams();
    params.set("q", next);
    if (filter !== "all") params.set("type", filter);
    router.push(`/search?${params}`, { scroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch();
  }

  function selectFilter(next: GlobalSearchFilter) {
    setFilter(next);
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  function rememberClick(entry: GlobalSearchEntry) {
    const value = trimmedQuery || entry.label;
    setRecent(recordRecentSearch(window.localStorage, value));
  }

  function renderResult(entry: GlobalSearchEntry) {
    if (entry.type === "product" && entry.image) {
      return (
        <Link
          className={styles.productResult}
          href={entry.href}
          onClick={() => rememberClick(entry)}
        >
          <SafeProductImage
            src={entry.image}
            alt={`${entry.brand ?? ""} ${entry.label}`.trim()}
          />
          <span className={styles.productResultCopy}>
            <small>{entry.brand}</small>
            <strong>{entry.label}</strong>
            <em>{entry.size}</em>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      );
    }

    const content = (
      <>
        <span className={styles.resultType}>{resultLabel(entry.type)}</span>
        <strong>{entry.label}</strong>
        <small>{entry.detail}</small>
        {entry.external ? (
          <ArrowUpRight size={18} aria-hidden="true" />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
      </>
    );
    const className = styles.resultCard;
    if (entry.external) {
      return (
        <a
          className={className}
          href={entry.href}
          target="_blank"
          rel="noreferrer"
          onClick={() => rememberClick(entry)}
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        className={className}
        href={entry.href}
        onClick={() => rememberClick(entry)}
      >
        {content}
      </Link>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className="sr-only">Search JeloCare</h1>

        <form className={styles.searchForm} role="search" onSubmit={onSubmit}>
          <Search size={22} strokeWidth={1.7} aria-hidden="true" />
          <input
            id="global-search-input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What are you looking for?"
            aria-label="Search JeloCare"
            autoComplete="off"
            autoFocus
          />
          {query ? (
            <button
              className={styles.clearInput}
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
          <label className={styles.typeFilter}>
            <span className="sr-only">Result type</span>
            <select
              value={filter}
              onChange={(event) =>
                selectFilter(event.target.value as GlobalSearchFilter)
              }
            >
              {globalSearchTypes.map((type) => (
                <option key={type} value={type}>
                  {globalSearchTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.submit} type="submit">
            Search
          </button>
        </form>
      </section>

      {isResultsPhase ? (
        <section
          className={styles.resultsPhase}
          aria-labelledby="search-results-heading"
        >
          <header className={styles.phaseHeading}>
            <div>
              <p className="eyebrow">Results</p>
              <h2 id="search-results-heading">
                {results.length
                  ? `Matches for “${trimmedQuery}”`
                  : `No match for “${trimmedQuery}”`}
              </h2>
            </div>
            <p role="status" aria-live="polite">
              {results.length} {results.length === 1 ? "result" : "results"}{" "}
              shown · {globalSearchTypeLabels[filter]}
            </p>
          </header>

          {results.length ? (
            <div className={styles.resultGroups}>
              {groupedResults.map((group) => (
                <section
                  className={styles.resultGroup}
                  key={group.type}
                  aria-labelledby={`results-${group.type}`}
                >
                  <div className={styles.groupHeading}>
                    <h3 id={`results-${group.type}`}>
                      {resultLabel(group.type)}
                    </h3>
                    <span>{group.matches.length}</span>
                  </div>
                  <div
                    className={`${styles.resultGrid} ${group.type === "product" ? styles.productGrid : ""}`}
                  >
                    {group.matches.map((entry) => (
                      <article key={entry.id}>{renderResult(entry)}</article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>
              <p>Try a broader name, a brand, an ingredient, or a concern.</p>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                }}
              >
                Search all result types
              </button>
            </div>
          )}

          <div className={styles.productHandoff}>
            <div>
              <p className="eyebrow">Need product filters?</p>
              <h3>Continue in the catalogue.</h3>
            </div>
            <Link
              href={`/products?q=${encodeURIComponent(trimmedQuery)}#all-products`}
            >
              Refine products <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <section
          className={styles.emptyPhase}
          aria-label="Search starting points"
        >
          <section className={styles.categorySection}>
            <header className={styles.sectionHeading}>
              <p className="eyebrow">Browse the catalogue</p>
              <h2>Choose a care area.</h2>
            </header>
            <div className={styles.categoryRail}>
              {categories.map((category, index) => (
                <Link
                  href={category.href}
                  key={category.id}
                  onClick={() => rememberClick(category)}
                >
                  <span>0{index + 1}</span>
                  <strong>{category.label}</strong>
                  <small>{category.detail}</small>
                  <ArrowRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <div className={styles.startingGrid}>
            <section className={styles.starters}>
              <header className={styles.sectionHeading}>
                <p className="eyebrow">Reviewed starting points</p>
                <h2>Begin with clear context.</h2>
              </header>
              <div className={styles.starterList}>
                {starters.map((entry) => (
                  <article key={entry.id}>{renderResult(entry)}</article>
                ))}
              </div>
            </section>

            <section className={styles.recent}>
              <header>
                <div>
                  <p className="eyebrow">On this device</p>
                  <h2>Recent searches.</h2>
                </div>
                {recent.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRecent(clearRecentSearches(window.localStorage))
                    }
                  >
                    Clear
                  </button>
                ) : null}
              </header>
              {recent.length ? (
                <div className={styles.recentList}>
                  {recent.map((item) => (
                    <button
                      type="button"
                      key={item.toLocaleLowerCase("en-NG")}
                      onClick={() => submitSearch(item)}
                    >
                      <Clock3 size={16} aria-hidden="true" />
                      <span>{item}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.recentEmpty}>
                  Searches you submit stay in this browser.
                </p>
              )}
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
