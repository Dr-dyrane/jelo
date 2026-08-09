"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useModalDialog } from "@/components/ui/use-modal-dialog";
import { ShareButton } from "@/components/share/share-button";
import {
  EvidenceGradeBadge,
  SafetyBadge,
  ClinicalCaution,
  SourceList,
  ReviewedOn,
} from "@/components/clinical/clinical-primitives";
import type {
  EvidenceGradeLevel,
  SafetyStatus,
  SourceEntry,
} from "@/components/clinical/clinical-primitives";
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
  /** Enriched clinical knowledge — only present when source data supports it */
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

const evidenceLabel = {
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
  other: "Other",
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

function concentration(value: number | undefined, productName: string) {
  if (value === undefined || productName.includes(`${value}%`)) return "";
  return `${value}% `;
}

function productCountLabel(count: number) {
  return `${count} source-checked ${count === 1 ? "product" : "products"}`;
}

export function IngredientExplorer({
  ingredients,
}: {
  ingredients: IngredientCard[];
}) {
  const dialogId = useId();
  const { dialogRef, triggerRef, open, close } = useModalDialog();
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
      gentle: ingredients.filter(
        (ingredient) => ingredient.sensitiveSkinStatus === "generally_safe",
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
          (view === "gentle" &&
            ingredient.sensitiveSkinStatus === "generally_safe");
        if (!matchesView) return false;
        if (!normalized) return true;
        return [
          ingredient.name,
          ingredient.inciName,
          ingredient.summary,
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

  function showIngredient(slug: string, opener: HTMLButtonElement) {
    triggerRef.current = opener;
    setOpenSlug(slug);
    window.requestAnimationFrame(open);
  }

  function closeIngredient() {
    close();
    setOpenSlug(null);
  }

  function resetLibrary() {
    setQuery("");
    setView("all");
  }

  return (
    <section className={styles.explorer} aria-label="Ingredient library">
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Search ingredients</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ingredient or product"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear ingredient search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </label>

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
              onClick={() => setView(item.id)}
            >
              {item.label}
              <span>{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.resultBar}>
        <p role="status" aria-live="polite" aria-atomic="true">
          <strong>{visible.length}</strong>{" "}
          {visible.length === 1 ? "ingredient" : "ingredients"} shown
        </p>
        {hasFilters ? (
          <button type="button" onClick={resetLibrary}>
            Clear
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
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls={dialogId}
                  aria-expanded={openSlug === ingredient.slug}
                  onClick={(event) =>
                    showIngredient(ingredient.slug, event.currentTarget)
                  }
                >
                  View <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No match</p>
          <h2>Try another name.</h2>
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
        onClose={() => setOpenSlug(null)}
        onCancel={() => setOpenSlug(null)}
        onKeyDownCapture={(event) => {
          if (
            event.key === "Escape" &&
            dialogRef.current?.dataset.fallbackModal === "true"
          ) {
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

/**
 * Progressive disclosure ingredient detail sheet.
 *
 * First view answers:
 * - What is it? (name, INCI, family, summary)
 * - Why might I use it? (concerns it may help with)
 * - Is there anything important I should know? (sensitive skin, pregnancy, caution)
 *
 * Deeper evidence (timing, photosensitivity, irritation, sources, products)
 * is behind a disclosure toggle.
 */
function IngredientDetailSheet({
  selected,
  dialogId,
  onClose,
}: {
  selected: IngredientCard;
  dialogId: string;
  onClose: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();
  const concernLinks = concernGuideLinks(selected.concerns ?? []);

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

  const hasDeeperData = Boolean(
    selected.family ||
    (selected.concerns && selected.concerns.length > 0) ||
    (selected.allowedTimes && selected.allowedTimes.length > 0) ||
    selected.photosensitivity ||
    selected.irritationRisk ||
    selected.pregnancyStatus ||
    selected.nursingStatus ||
    (selected.sources && selected.sources.length > 0) ||
    selected.reviewedAt,
  );

  return (
    <div className={styles.sheet}>
      <span className={styles.handle} aria-hidden="true" />
      <header className={styles.sheetHeader}>
        <div>
          <p>Ingredient guide</p>
          <h2 id={`${dialogId}-title`}>{selected.name}</h2>
          {selected.inciName !== selected.name ? (
            <span>{selected.inciName}</span>
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
        {/* First view: What is it? */}
        <p className={styles.sheetSummary}>{selected.summary}</p>
        {selected.family ? (
          <p className={styles.sheetFamily}>
            {familyLabels[selected.family] ?? selected.family}
          </p>
        ) : null}

        {/* First view: Why might I use it? */}
        {concernLinks.length > 0 ? (
          <div className={styles.sheetConcerns}>
            <p className={styles.sheetSectionLabel}>May help with</p>
            <div className={styles.sheetChips}>
              {concernLinks.map((concern) => (
                <Link
                  key={concern.slug}
                  href={concern.href}
                  className={styles.sheetChip}
                  onClick={onClose}
                >
                  {concern.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* First view: Is there anything important I should know? */}
        <div className={styles.sheetBadges}>
          <EvidenceGradeBadge level={selected.evidenceGrade} />
          <SafetyBadge status={selected.sensitiveSkinStatus} />
        </div>
        {hasCaution ? <ClinicalCaution text={cautionText} /> : null}

        {/* Deeper evidence behind progressive disclosure */}
        {hasDeeperData ? (
          <div className={styles.disclosureWrap}>
            <button
              type="button"
              className={styles.disclosureToggle}
              aria-expanded={showDetails}
              aria-controls={detailsId}
              onClick={() => setShowDetails((v) => !v)}
            >
              <span>{showDetails ? "Hide details" : "More detail"}</span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={showDetails ? styles.chevronOpen : ""}
              />
            </button>
            {showDetails ? (
              <div id={detailsId} className={styles.disclosureBody}>
                {selected.allowedTimes && selected.allowedTimes.length > 0 ? (
                  <div className={styles.detailRow}>
                    <dt>Routine timing</dt>
                    <dd>
                      {selected.allowedTimes
                        .map((t) => timeLabels[t] ?? t)
                        .join(" · ")}
                    </dd>
                  </div>
                ) : null}
                {selected.photosensitivity ? (
                  <div className={styles.detailRow}>
                    <dt>Sun sensitivity</dt>
                    <dd>{photosensitivityLabels[selected.photosensitivity]}</dd>
                  </div>
                ) : null}
                {selected.irritationRisk ? (
                  <div className={styles.detailRow}>
                    <dt>Irritation</dt>
                    <dd>{irritationLabels[selected.irritationRisk]}</dd>
                  </div>
                ) : null}
                {selected.pregnancyStatus ? (
                  <div className={styles.detailRow}>
                    <dt>Pregnancy</dt>
                    <dd>{pregnancyLabels[selected.pregnancyStatus]}</dd>
                  </div>
                ) : null}
                {selected.nursingStatus ? (
                  <div className={styles.detailRow}>
                    <dt>Nursing</dt>
                    <dd>{nursingLabels[selected.nursingStatus]}</dd>
                  </div>
                ) : null}
                {selected.sources && selected.sources.length > 0 ? (
                  <div className={styles.detailSources}>
                    <SourceList sources={selected.sources} label="Sources" />
                  </div>
                ) : null}
                {selected.reviewedAt ? (
                  <ReviewedOn date={selected.reviewedAt} />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <section
          className={styles.productSection}
          aria-labelledby={`${dialogId}-products`}
        >
          <div className={styles.productHeading}>
            <h3 id={`${dialogId}-products`}>Found in</h3>
            <span>{productCountLabel(selected.products.length)}</span>
          </div>
          <div className={styles.products}>
            {selected.products.map((product) => (
              <article className={styles.product} key={product.slug}>
                <Link href={`/products/${product.slug}`} onClick={onClose}>
                  <span>{product.brand}</span>
                  <strong>
                    {concentration(product.concentrationPercent, product.name)}
                    {product.name}
                  </strong>
                </Link>
                <a href={product.sourceUrl} target="_blank" rel="noreferrer">
                  Source <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

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
