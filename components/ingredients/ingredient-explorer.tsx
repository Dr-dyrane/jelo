"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ClinicalCaution,
  EvidenceGradeBadge,
  ReviewedOn,
  SafetyBadge,
  SourceList,
} from "@/components/clinical/clinical-primitives";
import type {
  EvidenceGradeLevel,
  SafetyStatus,
  SourceEntry,
} from "@/components/clinical/clinical-primitives";
import { ShareButton } from "@/components/share/share-button";
import { useModalDialog } from "@/components/ui/use-modal-dialog";
import { concernGuideLinks } from "@/lib/clinical/care-context-links";
import styles from "./ingredient-explorer.module.css";

export type IngredientProduct = {
  slug: string;
  brand: string;
  name: string;
  concentrationPercent?: number;
  sourceUrl: string;
};

export type IngredientCard = {
  slug: string;
  name: string;
  inciName: string;
  summary: string;
  evidenceGrade: EvidenceGradeLevel;
  sensitiveSkinStatus: SafetyStatus;
  products: IngredientProduct[];
  /** Enriched clinical knowledge — only present when source data supports it. */
  family?: string;
  concerns?: string[];
  allowedTimes?: string[];
  pregnancyStatus?: SafetyStatus;
  nursingStatus?: SafetyStatus;
  photosensitivity?: "none" | "low" | "moderate" | "high";
  irritationRisk?: "low" | "moderate" | "high";
  sources?: SourceEntry[];
  reviewedAt?: string;
};

type LibraryView = "all" | "high" | "gentle";

const evidenceLabel: Record<EvidenceGradeLevel, string> = {
  high: "High evidence",
  moderate: "Moderate evidence",
  emerging: "Early evidence",
  insufficient: "Not enough evidence",
  limited: "Limited evidence",
};

const skinLabel: Record<SafetyStatus, string> = {
  safe: "Usually gentle",
  generally_safe: "Usually gentle",
  caution: "Go slowly",
  use_with_caution: "Go slowly",
  avoid: "Avoid on sensitive skin",
  unknown: "Sensitivity unknown",
};

const familyLabels: Record<string, string> = {
  retinoid: "Retinoid",
  exfoliant: "Exfoliant",
  antimicrobial: "Antimicrobial",
  brightening: "Brightening",
  barrier: "Barrier support",
  hydrating: "Hydrating",
  sunscreen: "Sunscreen",
  other: "Ingredient guide",
};

const timeLabels: Record<string, string> = {
  morning: "Morning",
  evening: "Evening",
  weekly: "Weekly",
  any: "Any time",
};

const photosensitivityLabels: Record<string, string> = {
  none: "No sun sensitivity",
  low: "Low sun sensitivity",
  moderate: "Use with daily SPF",
  high: "Use with daily SPF",
};

const irritationLabels: Record<string, string> = {
  low: "Low irritation risk",
  moderate: "Moderate irritation risk",
  high: "Higher irritation risk",
};

const pregnancyLabels: Record<SafetyStatus, string> = {
  safe: "Generally safe in pregnancy",
  generally_safe: "Generally safe in pregnancy",
  caution: "Check with a clinician during pregnancy",
  use_with_caution: "Check with a clinician during pregnancy",
  avoid: "Avoid during pregnancy",
  unknown: "Pregnancy safety unknown",
};

const nursingLabels: Record<SafetyStatus, string> = {
  safe: "Generally safe while nursing",
  generally_safe: "Generally safe while nursing",
  caution: "Check with a clinician while nursing",
  use_with_caution: "Check with a clinician while nursing",
  avoid: "Avoid while nursing",
  unknown: "Nursing safety unknown",
};

const views: Array<{ id: LibraryView; label: string }> = [
  { id: "all", label: "All" },
  { id: "high", label: "High evidence" },
  { id: "gentle", label: "Usually gentle" },
];

function isGentle(status: SafetyStatus) {
  return status === "safe" || status === "generally_safe";
}

function productName(product: IngredientProduct) {
  const value = product.concentrationPercent;
  if (value === undefined || product.name.includes(`${value}%`)) {
    return product.name;
  }
  return `${value}% ${product.name}`;
}

function productCountLabel(count: number) {
  return `${count} source-checked ${count === 1 ? "product" : "products"}`;
}

function libraryView(value: string | null): LibraryView {
  return value === "high" || value === "gentle" ? value : "all";
}

export function IngredientExplorer({
  ingredients,
}: {
  ingredients: IngredientCard[];
}) {
  const dialogId = useId();
  const { dialogRef, triggerRef, open, close } = useModalDialog();
  const ingredientButtons = useRef(new Map<string, HTMLButtonElement>());
  const openRef = useRef(open);
  const closeRef = useRef(close);
  const openSlugRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const normalized = query.trim().toLowerCase();
  const selected =
    ingredients.find((ingredient) => ingredient.slug === openSlug) ?? null;

  const counts = useMemo(
    () => ({
      all: ingredients.length,
      high: ingredients.filter(
        (ingredient) => ingredient.evidenceGrade === "high",
      ).length,
      gentle: ingredients.filter((ingredient) =>
        isGentle(ingredient.sensitiveSkinStatus),
      ).length,
    }),
    [ingredients],
  );

  const visible = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        const matchesView =
          view === "all" ||
          (view === "high" && ingredient.evidenceGrade === "high") ||
          (view === "gentle" && isGentle(ingredient.sensitiveSkinStatus));
        if (!matchesView) return false;
        if (!normalized) return true;

        return [
          ingredient.name,
          ingredient.inciName,
          ingredient.summary,
          ingredient.family ?? "",
          ...(ingredient.concerns ?? []),
          ...ingredient.products.flatMap((product) => [
            product.brand,
            product.name,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      }),
    [ingredients, normalized, view],
  );

  const hasFilters = Boolean(normalized) || view !== "all";
  const resultLabel = `${visible.length} of ${ingredients.length} ${
    ingredients.length === 1 ? "ingredient" : "ingredients"
  } shown`;

  useEffect(() => {
    openRef.current = open;
    closeRef.current = close;
    openSlugRef.current = openSlug;
  }, [close, open, openSlug]);

  useEffect(() => {
    function readLocation() {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setView(libraryView(params.get("view")));

      const slug = decodeURIComponent(window.location.hash.slice(1));
      const ingredient = ingredients.find((item) => item.slug === slug);
      if (!ingredient) {
        if (openSlugRef.current) {
          closeRef.current();
          setOpenSlug(null);
        }
        return;
      }

      const opener = ingredientButtons.current.get(ingredient.slug);
      if (opener) triggerRef.current = opener;
      setOpenSlug(ingredient.slug);
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => openRef.current()),
      );
    }

    const initialRead = window.setTimeout(readLocation, 0);
    window.addEventListener("popstate", readLocation);
    window.addEventListener("hashchange", readLocation);
    return () => {
      window.clearTimeout(initialRead);
      window.removeEventListener("popstate", readLocation);
      window.removeEventListener("hashchange", readLocation);
    };
  }, [ingredients, triggerRef]);

  function updateLibraryUrl(nextQuery: string, nextView: LibraryView) {
    const url = new URL(window.location.href);
    const cleanedQuery = nextQuery.trim();

    if (cleanedQuery) url.searchParams.set("q", cleanedQuery);
    else url.searchParams.delete("q");

    if (nextView === "all") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function showIngredient(slug: string, opener: HTMLButtonElement) {
    triggerRef.current = opener;
    const url = new URL(window.location.href);
    url.hash = slug;
    window.history.pushState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setOpenSlug(slug);
    window.requestAnimationFrame(open);
  }

  function clearIngredientHash() {
    const url = new URL(window.location.href);
    if (!url.hash) return;
    url.hash = "";
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}`,
    );
  }

  function closeIngredient() {
    clearIngredientHash();
    close();
    setOpenSlug(null);
  }

  function resetLibrary() {
    setQuery("");
    setView("all");
    updateLibraryUrl("", "all");
  }

  return (
    <section className={styles.explorer} aria-label="Ingredient library">
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={19} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Search ingredients</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              updateLibraryUrl(event.target.value, view);
            }}
            placeholder="Ingredient, product, brand or concern"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                updateLibraryUrl("", view);
              }}
              aria-label="Clear ingredient search"
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <div className={styles.viewsWrap}>
          <span>Browse by</span>
          <div
            className={styles.views}
            role="group"
            aria-label="Filter ingredients"
          >
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => {
                  setView(item.id);
                  updateLibraryUrl(query, item.id);
                }}
              >
                {item.label}
                <span>{counts[item.id]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.resultBar}>
        <p role="status" aria-live="polite" aria-atomic="true">
          {resultLabel}
        </p>
        {hasFilters ? (
          <button type="button" onClick={resetLibrary}>
            Clear all
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <div className={styles.grid}>
          {visible.map((ingredient) => (
            <article
              className={styles.card}
              id={ingredient.slug}
              key={ingredient.slug}
            >
              <div className={styles.cardTop}>
                <p>{evidenceLabel[ingredient.evidenceGrade]}</p>
                <span data-status={ingredient.sensitiveSkinStatus}>
                  {skinLabel[ingredient.sensitiveSkinStatus]}
                </span>
              </div>
              <div className={styles.cardCopy}>
                <h2>{ingredient.name}</h2>
                {ingredient.inciName !== ingredient.name ? (
                  <p className={styles.inci}>{ingredient.inciName}</p>
                ) : null}
                <p className={styles.summary}>{ingredient.summary}</p>
              </div>
              <div className={styles.cardFooter}>
                <span>{productCountLabel(ingredient.products.length)}</span>
                <button
                  ref={(node) => {
                    if (node)
                      ingredientButtons.current.set(ingredient.slug, node);
                    else ingredientButtons.current.delete(ingredient.slug);
                  }}
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls={dialogId}
                  aria-expanded={openSlug === ingredient.slug}
                  aria-label={`Open ${ingredient.name} ingredient guide`}
                  onClick={(event) =>
                    showIngredient(ingredient.slug, event.currentTarget)
                  }
                >
                  Open guide <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No ingredients found</p>
          <h2>Try another name or product.</h2>
          <span>
            Search also checks INCI names, brands and related concerns.
          </span>
          <button type="button" onClick={resetLibrary}>
            Show all ingredients
          </button>
        </div>
      )}

      <dialog
        className={styles.dialog}
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        tabIndex={-1}
        onClose={() => {
          clearIngredientHash();
          setOpenSlug(null);
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeIngredient();
        }}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeIngredient();
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeIngredient();
        }}
      >
        {selected ? (
          <IngredientDetailSheet
            selected={selected}
            dialogId={dialogId}
            onClose={closeIngredient}
          />
        ) : null}
      </dialog>
    </section>
  );
}

function IngredientDetailSheet({
  selected,
  dialogId,
  onClose,
}: {
  selected: IngredientCard;
  dialogId: string;
  onClose: () => void;
}) {
  const concernLinks = concernGuideLinks(selected.concerns ?? []);
  const detailRows = [
    selected.allowedTimes?.length
      ? {
          label: "Routine timing",
          value: selected.allowedTimes
            .map((time) => timeLabels[time] ?? time)
            .join(" · "),
        }
      : null,
    selected.photosensitivity
      ? {
          label: "Sun sensitivity",
          value: photosensitivityLabels[selected.photosensitivity],
        }
      : null,
    selected.irritationRisk
      ? {
          label: "Irritation",
          value: irritationLabels[selected.irritationRisk],
        }
      : null,
    selected.pregnancyStatus
      ? {
          label: "Pregnancy",
          value: pregnancyLabels[selected.pregnancyStatus],
        }
      : null,
    selected.nursingStatus
      ? {
          label: "Nursing",
          value: nursingLabels[selected.nursingStatus],
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  const hasCaution =
    selected.sensitiveSkinStatus === "use_with_caution" ||
    selected.sensitiveSkinStatus === "caution" ||
    selected.sensitiveSkinStatus === "avoid" ||
    selected.irritationRisk === "high" ||
    selected.pregnancyStatus === "avoid" ||
    selected.pregnancyStatus === "caution" ||
    selected.pregnancyStatus === "use_with_caution";

  const cautionText =
    selected.sensitiveSkinStatus === "avoid"
      ? "Avoid on sensitive skin. Patch test before any use."
      : selected.sensitiveSkinStatus === "use_with_caution" ||
          selected.sensitiveSkinStatus === "caution"
        ? "Go slowly. Patch test first and reduce frequency if irritation occurs."
        : selected.irritationRisk === "high"
          ? "Higher irritation risk. Introduce gradually and reduce frequency if needed."
          : selected.pregnancyStatus === "avoid"
            ? "Avoid during pregnancy. Check with a clinician before use."
            : selected.pregnancyStatus === "caution" ||
                selected.pregnancyStatus === "use_with_caution"
              ? "Check with a clinician before use during pregnancy."
              : null;

  return (
    <div className={styles.sheet}>
      <span className={styles.handle} aria-hidden="true" />
      <header className={styles.sheetHeader}>
        <div>
          <p>
            {selected.family
              ? (familyLabels[selected.family] ?? selected.family)
              : "Ingredient guide"}
          </p>
          <h2 id={`${dialogId}-title`}>{selected.name}</h2>
          {selected.inciName !== selected.name ? (
            <span>INCI · {selected.inciName}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${selected.name} guide`}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.sheetBody}>
        <p className={styles.sheetSummary}>{selected.summary}</p>

        <section
          className={styles.evidenceSection}
          aria-labelledby={`${dialogId}-evidence`}
        >
          <div className={styles.sectionHeading}>
            <h3 id={`${dialogId}-evidence`}>Evidence & cautions</h3>
            <p>Ingredient-level guidance</p>
          </div>
          <div className={styles.sheetBadges}>
            <EvidenceGradeBadge level={selected.evidenceGrade} />
            <SafetyBadge status={selected.sensitiveSkinStatus} />
          </div>
          {hasCaution && cautionText ? (
            <ClinicalCaution text={cautionText} />
          ) : null}
          {detailRows.length ? (
            <dl className={styles.detailList}>
              {detailRows.map((row) => (
                <div className={styles.detailRow} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        {concernLinks.length ? (
          <section
            className={styles.relatedSection}
            aria-labelledby={`${dialogId}-concerns`}
          >
            <div className={styles.sectionHeading}>
              <h3 id={`${dialogId}-concerns`}>Related care guides</h3>
              <p>Continue by concern</p>
            </div>
            <div className={styles.sheetChips}>
              {concernLinks.map((concern) => (
                <Link
                  key={concern.slug}
                  href={concern.href}
                  className={styles.sheetChip}
                  onClick={onClose}
                >
                  {concern.label}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={styles.productSection}
          aria-labelledby={`${dialogId}-products`}
        >
          <div className={styles.sectionHeading}>
            <h3 id={`${dialogId}-products`}>Found in products</h3>
            <p>{productCountLabel(selected.products.length)}</p>
          </div>
          <div className={styles.products}>
            {selected.products.map((product) => (
              <article className={styles.product} key={product.slug}>
                <div className={styles.productCopy}>
                  <span>{product.brand}</span>
                  <strong>{productName(product)}</strong>
                </div>
                <div className={styles.productActions}>
                  <Link href={`/products/${product.slug}`} onClick={onClose}>
                    View product <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <a href={product.sourceUrl} target="_blank" rel="noreferrer">
                    Source <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {selected.sources?.length || selected.reviewedAt ? (
          <section
            className={styles.sourceSection}
            aria-label="Ingredient sources"
          >
            {selected.sources?.length ? (
              <SourceList sources={selected.sources} label="Sources" />
            ) : null}
            {selected.reviewedAt ? (
              <ReviewedOn date={selected.reviewedAt} />
            ) : null}
          </section>
        ) : null}

        <div className={styles.sheetFoot}>
          <p className={styles.sheetNote}>
            Evidence describes the ingredient, not the whole formula.
          </p>
          <ShareButton
            path={`/share/ingredient/${selected.slug}`}
            title={selected.name}
            label="Share"
            inline
          />
        </div>
      </div>
    </div>
  );
}
