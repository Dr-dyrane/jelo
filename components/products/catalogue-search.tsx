"use client";

import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { catalogueSuggestionMinimumQueryLength } from "@/lib/catalogue/catalogue-search-request";
import { useControlledDialog } from "@/components/ui/use-controlled-dialog";
import { recordCatalogueTransition } from "./catalogue-transition-tracker";
import {
  matchingCatalogueSearchSuggestions,
  type CatalogueSearchSuggestion,
  type CatalogueSearchSuggestionKind,
} from "./catalogue-search-suggestions";
import styles from "./catalogue-search.module.css";

const kindLabels: Record<CatalogueSearchSuggestionKind, string> = {
  product: "Product",
  company: "Company",
  category: "Category",
  guide: "Guide",
};

function validRemoteSuggestions(value: unknown): CatalogueSearchSuggestion[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("suggestions" in value) ||
    !Array.isArray(value.suggestions)
  )
    return [];
  return value.suggestions.filter(
    (suggestion): suggestion is CatalogueSearchSuggestion =>
      suggestion != null &&
      typeof suggestion === "object" &&
      "kind" in suggestion &&
      ["product", "company", "category", "guide"].includes(
        String(suggestion.kind),
      ) &&
      "label" in suggestion &&
      typeof suggestion.label === "string" &&
      "detail" in suggestion &&
      typeof suggestion.detail === "string" &&
      "href" in suggestion &&
      typeof suggestion.href === "string" &&
      (!("keywords" in suggestion) ||
        suggestion.keywords === undefined ||
        (Array.isArray(suggestion.keywords) &&
          suggestion.keywords.every(
            (keyword: unknown) => typeof keyword === "string",
          ))) &&
      (suggestion.href.startsWith("/products") ||
        suggestion.href.startsWith("/concerns/")),
  );
}

type Props = {
  defaultValue: string;
  clearHref: string;
  market: "NG" | "US";
  marketHrefs: Record<"NG" | "US", string>;
  suggestions: CatalogueSearchSuggestion[];
};

type RemoteSuggestionOutcome = {
  query: string;
  state: "ready" | "empty" | "paused" | "unavailable";
};

export function CatalogueSearch({
  defaultValue,
  clearHref,
  market,
  marketHrefs,
  suggestions,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteSuggestions, setRemoteSuggestions] = useState<
    CatalogueSearchSuggestion[]
  >([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [remoteOutcome, setRemoteOutcome] =
    useState<RemoteSuggestionOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const listboxId = `${useId().replace(/:/g, "")}-catalogue-suggestions`;
  const requestQuery = value.trim().replace(/\s+/g, " ");
  const matches = useMemo(
    () =>
      matchingCatalogueSearchSuggestions(
        [
          ...suggestions,
          ...(remoteQuery === requestQuery ? remoteSuggestions : []),
        ],
        value,
      ),
    [remoteQuery, remoteSuggestions, requestQuery, suggestions, value],
  );
  const isLoading =
    requestQuery.length >= catalogueSuggestionMinimumQueryLength &&
    (loading || remoteQuery !== requestQuery);
  const settledRemoteState =
    remoteOutcome?.query === requestQuery ? remoteOutcome.state : null;
  const searchAllHref = useMemo(() => {
    const params = new URLSearchParams({ q: requestQuery, market });
    return `/products?${params.toString()}#all-products`;
  }, [market, requestQuery]);
  const remoteFeedback =
    !isLoading && settledRemoteState === "paused"
      ? "Search is taking a short pause."
      : !isLoading && settledRemoteState === "unavailable"
        ? "More results are not available right now."
        : !isLoading && settledRemoteState === "empty"
          ? matches.length > 0
            ? "That is everything we found here."
            : "No close match yet."
          : "";
  const currentActiveIndex =
    activeIndex >= 0 && activeIndex < matches.length ? activeIndex : -1;
  const showSuggestions =
    expanded && (matches.length > 0 || isLoading || Boolean(remoteFeedback));

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  // Hide the fixed site header when search is focused on mobile so the
  // search bar can move to top: 0, creating room for suggestions.
  useEffect(() => {
    if (expanded) {
      document.body.dataset.searchActive = "true";
    } else {
      delete document.body.dataset.searchActive;
    }
    return () => {
      delete document.body.dataset.searchActive;
    };
  }, [expanded]);

  // Mobile bottom sheet dialog for suggestions — uses the browser's top
  // layer via <dialog>, so no z-index fighting with hero/page content.
  const {
    dialogRef: sheetDialogRef,
    handleCancel: handleSheetCancel,
    handleBackdropClick: handleSheetBackdropClick,
  } = useControlledDialog({
    open: showSuggestions,
    onClose: closeSuggestions,
    restoreFocusRef: inputRef,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    if (requestQuery.length < catalogueSuggestionMinimumQueryLength) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: requestQuery, market });
        const response = await fetch(
          `/api/products/suggestions?${params.toString()}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (response.status === 429) {
          if (!controller.signal.aborted) {
            setRemoteSuggestions([]);
            setRemoteQuery(requestQuery);
            setRemoteOutcome({ query: requestQuery, state: "paused" });
          }
          return;
        }
        if (!response.ok)
          throw new Error(`Catalogue search returned ${response.status}.`);
        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          const nextSuggestions = validRemoteSuggestions(payload);
          setRemoteSuggestions(nextSuggestions);
          setRemoteQuery(requestQuery);
          setRemoteOutcome({
            query: requestQuery,
            state: nextSuggestions.length > 0 ? "ready" : "empty",
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Catalogue suggestions unavailable.", error);
          setRemoteSuggestions([]);
          setRemoteQuery(requestQuery);
          setRemoteOutcome({ query: requestQuery, state: "unavailable" });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [market, requestQuery]);

  function openSuggestions() {
    setExpanded(true);
  }

  function closeSuggestions() {
    setExpanded(false);
    setActiveIndex(-1);
  }

  function followSuggestion(suggestion: CatalogueSearchSuggestion) {
    closeSuggestions();
    if (suggestion.href.startsWith("/products?"))
      recordCatalogueTransition(suggestion.href);
    router.push(suggestion.href);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const suggestion =
      showSuggestions && currentActiveIndex >= 0
        ? matches[currentActiveIndex]
        : null;
    if (!suggestion) return;
    event.preventDefault();
    followSuggestion(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && showSuggestions && currentActiveIndex >= 0) {
      event.preventDefault();
      followSuggestion(matches[currentActiveIndex]);
      return;
    }
    if (event.key === "Escape") {
      if (expanded) {
        event.preventDefault();
        closeSuggestions();
      }
      return;
    }
    if (event.key === "Tab") {
      closeSuggestions();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setExpanded(true);
    if (!matches.length) return;
    setActiveIndex((current) => {
      if (event.key === "ArrowDown")
        return current >= matches.length - 1 ? 0 : current + 1;
      return current <= 0 ? matches.length - 1 : current - 1;
    });
  }

  function clearSearch() {
    setValue("");
    setActiveIndex(-1);
    if (defaultValue) {
      closeSuggestions();
      recordCatalogueTransition(clearHref);
      router.push(clearHref);
      return;
    }
    setExpanded(true);
    inputRef.current?.focus();
  }

  const suggestionContent = (
    <>
      <div className={styles.suggestionHeading}>
        <span>{value.trim() ? "Suggestions" : "Start here"}</span>
        <button
          type="button"
          onClick={closeSuggestions}
          aria-label="Close suggestions"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.suggestionList} id={listboxId} role="listbox">
        {isLoading && matches.length === 0 ? (
          <div
            className={styles.loadingSuggestion}
            role="option"
            aria-disabled="true"
            aria-selected="false"
          >
            <span aria-hidden="true" />
            <strong>Finding matches</strong>
          </div>
        ) : null}
        {matches.map((suggestion, index) => (
          <Link
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={currentActiveIndex === index}
            tabIndex={-1}
            href={suggestion.href}
            onPointerMove={() => setActiveIndex(index)}
            onClick={closeSuggestions}
            key={`${suggestion.kind}-${suggestion.href}`}
          >
            <span>
              <small>{kindLabels[suggestion.kind]}</small>
              <strong>{suggestion.label}</strong>
              <em>{suggestion.detail}</em>
            </span>
            <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        ))}
      </div>
      {remoteFeedback ? (
        <div className={styles.searchFallback}>
          <p>{remoteFeedback}</p>
          <Link
            href={searchAllHref}
            onClick={() => {
              closeSuggestions();
              recordCatalogueTransition(searchAllHref);
            }}
          >
            <span>Search all products</span>
            <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div className={styles.shell} ref={rootRef}>
      <form
        className={styles.searchBar}
        action="/products#all-products"
        method="get"
        role="search"
        onSubmit={handleSubmit}
      >
        <Search size={21} strokeWidth={1.7} aria-hidden="true" />
        <label className="sr-only" htmlFor="catalogue-search">
          Search the catalogue
        </label>
        <input
          id="catalogue-search"
          ref={inputRef}
          name="q"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActiveIndex(-1);
            setExpanded(true);
          }}
          onFocus={openSuggestions}
          onKeyDown={handleKeyDown}
          placeholder="Product, company or barcode"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-activedescendant={
            showSuggestions && currentActiveIndex >= 0
              ? `${listboxId}-${currentActiveIndex}`
              : undefined
          }
        />
        {value ? (
          <button
            className={styles.clear}
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
        <input type="hidden" name="market" value={market} />
        <button className={styles.submit} type="submit" aria-label="Search">
          Search
        </button>
        <div className={styles.market} aria-label="Shopping market">
          <Link
            aria-current={market === "NG" ? "true" : undefined}
            className={market === "NG" ? styles.active : ""}
            href={marketHrefs.NG}
          >
            Nigeria
          </Link>
          <Link
            aria-current={market === "US" ? "true" : undefined}
            className={market === "US" ? styles.active : ""}
            href={marketHrefs.US}
          >
            US
          </Link>
        </div>
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {expanded
          ? `${matches.length} ${matches.length === 1 ? "suggestion" : "suggestions"}.${isLoading ? " Finding matches." : ""}${remoteFeedback ? ` ${remoteFeedback} Search all products is available.` : ""}`
          : ""}
      </p>
      {/* Desktop: absolute-positioned dropdown inside the shell */}
      {showSuggestions ? (
        <section
          className={styles.suggestions}
          aria-label="Search suggestions"
          aria-busy={isLoading}
        >
          {suggestionContent}
        </section>
      ) : null}

      {/* Mobile: bottom sheet dialog — uses browser top layer, no z-index fighting */}
      <dialog
        className={styles.suggestionSheet}
        ref={sheetDialogRef}
        aria-modal="true"
        aria-label="Search suggestions"
        onCancel={handleSheetCancel}
        onClick={handleSheetBackdropClick}
      >
        {showSuggestions ? suggestionContent : null}
      </dialog>
    </div>
  );
}
