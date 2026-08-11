"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DirectoryTypeahead } from "@/components/directory/directory-typeahead";
import styles from "@/app/(site)/retailers/retailers.module.css";
import {
  filterRetailerDirectory,
  type RetailerDirectoryItem,
} from "@/modules/commerce/retailer-directory-search";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? dateFormatter.format(new Date(parsed)) : "";
}

export function RetailerDirectory({
  items,
}: {
  items: readonly RetailerDirectoryItem[];
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => filterRetailerDirectory(items, query),
    [items, query],
  );
  const hasQuery = Boolean(query.trim());
  const searchItems = useMemo(
    () =>
      items.map((item) => ({
        href: `/retailers/${item.slug}`,
        name: item.name,
        detail: `${item.kind} · ${item.productCount} ${item.productCount === 1 ? "product" : "products"} · trust ${item.trust}`,
        searchText: item.evidenceNote,
      })),
    [items],
  );

  return (
    <div className={styles.directoryExperience}>
      <div className={styles.directoryTools}>
        <DirectoryTypeahead
          id="retailer-directory-search"
          label="Find a retailer"
          placeholder="Search retailer names"
          items={searchItems}
          value={query}
          onValueChange={setQuery}
        />
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
              <small>
                Trust {item.trust}
                {item.latestObservedAt
                  ? ` · ${formatDate(item.latestObservedAt)}`
                  : ""}
              </small>
              <small>{item.evidenceNote}</small>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.directoryEmpty} id="retailer-directory-results">
          <p>No retailer matches “{query.trim()}”.</p>
          <button type="button" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
