"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import styles from "@/app/(site)/retailers/retailers.module.css";
import {
  filterRetailerDirectory,
  type RetailerDirectoryItem,
} from "@/modules/commerce/retailer-directory-search";

export function RetailerDirectory({
  items,
}: {
  items: readonly RetailerDirectoryItem[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => filterRetailerDirectory(items, query),
    [items, query],
  );
  const hasQuery = Boolean(query.trim());

  function preventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function clearSearch() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className={styles.directoryExperience}>
      <div className={styles.directoryTools}>
        <form
          className={styles.directorySearch}
          role="search"
          onSubmit={preventSubmit}
        >
          <Search size={19} strokeWidth={1.7} aria-hidden="true" />
          <label className="sr-only" htmlFor="retailer-directory-search">
            Search retailers
          </label>
          <input
            id="retailer-directory-search"
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search retailers"
            autoComplete="off"
            aria-controls="retailer-directory-results"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") clearSearch();
            }}
          />
          {hasQuery ? (
            <button
              type="button"
              aria-label="Clear retailer search"
              onClick={clearSearch}
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </form>
        <p aria-live="polite">
          {hasQuery
            ? `${results.length} of ${items.length} sources`
            : `${items.length} sources`}
        </p>
      </div>

      {results.length ? (
        <div className={styles.storeGrid} id="retailer-directory-results">
          {results.map((item) => (
            <Link href={`/retailers/${item.slug}`} key={item.slug}>
              <span className={styles.storeNumber}>
                {String(item.rank).padStart(2, "0")}
              </span>
              <span className={styles.storeKind}>{item.kind}</span>
              <strong>{item.name}</strong>
              <small>
                {item.productCount}{" "}
                {item.productCount === 1 ? "product" : "products"} observed
              </small>
              <small>{item.evidenceNote}</small>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.directoryEmpty} id="retailer-directory-results">
          <p>No retailer matches “{query.trim()}”.</p>
          <button type="button" onClick={clearSearch}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
