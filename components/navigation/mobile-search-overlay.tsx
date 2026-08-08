"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  matchingCatalogueSearchSuggestions,
  type CatalogueSearchSuggestion,
} from "@/components/products/catalogue-search-suggestions";
import { catalogueSuggestionMinimumQueryLength } from "@/lib/catalogue/catalogue-search-request";
import styles from "./mobile-search-overlay.module.css";

type RemoteSuggestion = {
  kind: "product" | "company";
  label: string;
  detail?: string;
  href: string;
};

type MergedSuggestion = CatalogueSearchSuggestion | RemoteSuggestion;

type SearchState = "idle" | "loading" | "paused" | "done" | "empty";

const ease = [0.2, 0.8, 0.2, 1] as const;

type MobileSearchOverlayProps = {
  open: boolean;
  onClose: () => void;
  staticSuggestions?: CatalogueSearchSuggestion[];
};

export function MobileSearchOverlay({
  open,
  onClose,
  staticSuggestions = [],
}: MobileSearchOverlayProps) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState<
    RemoteSuggestion[]
  >([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      // Small delay to let the animation start
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
    // Reset state when closed — one-time capability reset per open/close cycle
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");

    setRemoteSuggestions([]);

    setSearchState("idle");

    setActiveIdx(-1);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Debounced remote search
  const fetchRemote = useCallback(async (q: string) => {
    if (q.length < catalogueSuggestionMinimumQueryLength) {
      setRemoteSuggestions([]);
      setSearchState("idle");
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearchState("loading");

    try {
      const res = await fetch(
        `/api/products/suggestions?q=${encodeURIComponent(q)}&market=NG`,
        { signal: controller.signal },
      );

      if (res.status === 429) {
        setSearchState("paused");
        return;
      }

      if (!res.ok) {
        setSearchState("done");
        return;
      }

      const json = await res.json();
      const data: RemoteSuggestion[] = json.suggestions ?? json ?? [];
      setRemoteSuggestions(data);
      setSearchState(data.length > 0 ? "done" : "empty");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchState("done");
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRemote(query);
    }, 140);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchRemote]);

  // Merge static + remote suggestions
  const merged = useMemo<MergedSuggestion[]>(() => {
    const local = matchingCatalogueSearchSuggestions(staticSuggestions, query);
    // Combine, deduplicate by href, limit to 8
    const seen = new Set<string>();
    const combined: MergedSuggestion[] = [];
    for (const s of [...local, ...remoteSuggestions]) {
      if (seen.has(s.href)) continue;
      seen.add(s.href);
      combined.push(s);
      if (combined.length >= 8) break;
    }
    return combined;
  }, [staticSuggestions, query, remoteSuggestions]);

  // Reset active index when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(-1);
  }, [merged]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && merged[activeIdx]) {
      router.push(merged[activeIdx].href);
      onClose();
      return;
    }
    if (query.trim()) {
      router.push(`/products?q=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, merged.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    }
  }

  const showSuggestions = merged.length > 0;
  const showEmpty =
    !showSuggestions &&
    searchState === "empty" &&
    query.length >= catalogueSuggestionMinimumQueryLength;
  const showPopular =
    !showSuggestions &&
    !showEmpty &&
    query.length === 0 &&
    staticSuggestions.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
          transition={{ duration: 0.35, ease }}
          role="dialog"
          aria-modal="true"
          aria-label="Search products"
        >
          <div className={styles.header}>
            <form className={styles.searchForm} onSubmit={handleSubmit}>
              <Search
                size={20}
                aria-hidden="true"
                className={styles.searchIcon}
              />
              <input
                ref={inputRef}
                type="search"
                className={styles.input}
                placeholder="Search products, brands, or barcodes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Search products"
                aria-autocomplete="list"
                aria-controls="mobile-search-results"
                aria-activedescendant={
                  activeIdx >= 0 ? `mobile-suggestion-${activeIdx}` : undefined
                }
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query ? (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              ) : null}
            </form>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close search"
            >
              Cancel
            </button>
          </div>

          <div
            className={styles.body}
            id="mobile-search-results"
            role="listbox"
            aria-label="Search results"
          >
            {searchState === "loading" ? (
              <div className={styles.statusRow}>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Searching…</span>
              </div>
            ) : null}

            {searchState === "paused" ? (
              <p className={styles.statusMsg}>
                Search is briefly paused. Try again in a moment.
              </p>
            ) : null}

            {showEmpty ? (
              <div className={styles.emptyState}>
                <p>No results for &ldquo;{query}&rdquo;.</p>
                <Link
                  href={`/products?q=${encodeURIComponent(query)}`}
                  className={styles.seeAll}
                  onClick={onClose}
                >
                  Search all products →
                </Link>
              </div>
            ) : null}

            {showPopular ? (
              <div className={styles.popularSection}>
                <p className={styles.sectionLabel}>
                  <TrendingUp size={14} aria-hidden="true" /> Popular
                </p>
                <div className={styles.popularChips}>
                  {staticSuggestions.slice(0, 8).map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className={styles.chip}
                      onClick={onClose}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {showSuggestions ? (
              <ul className={styles.resultList}>
                {merged.map((s, i) => (
                  <li key={`${s.href}-${i}`}>
                    <Link
                      id={`mobile-suggestion-${i}`}
                      href={s.href}
                      className={`${styles.resultItem} ${i === activeIdx ? styles.active : ""}`}
                      onClick={onClose}
                      role="option"
                      aria-selected={i === activeIdx}
                    >
                      <span className={styles.resultLabel}>{s.label}</span>
                      {s.detail ? (
                        <span className={styles.resultDetail}>{s.detail}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
                {query.trim() ? (
                  <li>
                    <Link
                      href={`/products?q=${encodeURIComponent(query.trim())}`}
                      className={styles.seeAllItem}
                      onClick={onClose}
                    >
                      Search all products for &ldquo;{query.trim()}&rdquo; →
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
