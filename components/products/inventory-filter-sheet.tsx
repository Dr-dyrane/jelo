"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { ExternalCatalogueCategory } from "@/data/external-catalogue";
import { matchingCompanies } from "@/lib/catalogue/catalogue-interactions";
import type { InventoryResult } from "@/lib/catalogue/inventory-repository";
import {
  inventoryRefinementPlan,
  type InventoryRefinementGroup,
  withActiveCompanyFacet,
} from "@/lib/catalogue/inventory-refinements";
import { useModalDialog } from "@/components/ui/use-modal-dialog";
import styles from "./inventory-filter-sheet.module.css";

type Props = {
  filters: InventoryResult["filters"];
  facets: InventoryResult["facets"];
  market: "NG" | "US";
  browse: string;
  total: number;
};

export function InventoryFilterSheet({
  filters,
  facets,
  market,
  browse,
  total,
}: Props) {
  const { dialogRef, triggerRef, open, close } = useModalDialog();
  const formRef = useRef<HTMLFormElement>(null);
  const filterViewRef = useRef<HTMLDivElement>(null);
  const companyViewRef = useRef<HTMLDivElement>(null);
  const concernViewRef = useRef<HTMLDivElement>(null);
  const companyButtonRef = useRef<HTMLButtonElement>(null);
  const concernButtonRef = useRef<HTMLButtonElement>(null);
  const companySearchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"filters" | "companies" | "concerns">(
    "filters",
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(filters.brand);
  const [selectedConcern, setSelectedConcern] = useState(filters.concern);
  const [showAllRefinements, setShowAllRefinements] = useState(false);
  const activeCount = [
    filters.category !== "All",
    filters.review !== "all",
    filters.sort !== "featured",
    Boolean(filters.concern),
    Boolean(filters.brand),
    Boolean(filters.step),
    filters.availability !== "all",
    filters.price !== "all",
  ].filter(Boolean).length;
  const resetHref =
    market === "US"
      ? "/products?market=US#all-products"
      : "/products#all-products";
  const priceLabels =
    market === "NG"
      ? { low: "Under ₦10k", mid: "₦10k–₦25k", high: "₦25k+" }
      : { low: "Under $15", mid: "$15–$35", high: "$35+" };
  const selectedConcernLabel = facets.concerns.find(
    (concern) => concern.value === selectedConcern,
  )?.label;
  const productConcerns = facets.concerns.filter(
    (concern) => concern.total > 0,
  );
  const guideOnlyConcerns = facets.concerns.filter(
    (concern) => concern.total === 0,
  );
  const companyFacets = withActiveCompanyFacet(facets.brands, selectedBrand);
  const companies = matchingCompanies(
    companyFacets,
    companyQuery,
    selectedBrand,
  );
  const sourceOptions = (
    [
      [
        "all",
        `All · ${facets.reviewed + facets.community}`,
        facets.reviewed + facets.community,
      ],
      ["reviewed", `JeloCare profiles · ${facets.reviewed}`, facets.reviewed],
      [
        "supportive",
        `Supportive use · ${facets.supportive}`,
        facets.supportive,
      ],
      ["community", `Community · ${facets.community}`, facets.community],
    ] as const
  ).filter(
    ([value, , count]) =>
      value === "all" || count > 0 || filters.review === value,
  );
  const categoryOptions = facets.categories.filter(
    ({ value, count }) => count > 0 || filters.category === value,
  );
  const stepOptions = facets.steps.filter(
    ({ value, count }) => count > 0 || filters.step === value,
  );
  const priceOptions = (
    [
      ["low", priceLabels.low, facets.priceBands.low],
      ["mid", priceLabels.mid, facets.priceBands.mid],
      ["high", priceLabels.high, facets.priceBands.high],
    ] as const
  ).filter(([value, , count]) => count > 0 || filters.price === value);
  const refinementPlan = inventoryRefinementPlan({
    filters,
    facets,
    browse,
    total,
  });

  function openSheet() {
    formRef.current?.reset();
    setView("filters");
    setCompanyQuery("");
    setSelectedBrand(filters.brand);
    setSelectedConcern(filters.concern);
    setShowAllRefinements(false);
    open();
  }

  function closeSheet() {
    setView("filters");
    setCompanyQuery("");
    setSelectedBrand(filters.brand);
    setSelectedConcern(filters.concern);
    setShowAllRefinements(false);
    close();
  }

  function showCompanies() {
    setView("companies");
    setCompanyQuery("");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollTo({ top: 0 });
      companySearchRef.current?.focus();
    });
  }

  function showConcerns() {
    setView("concerns");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollTo({ top: 0 });
      concernViewRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
  }

  function chooseCompany(value: string) {
    setSelectedBrand(value);
    setView("filters");
    window.requestAnimationFrame(() => companyButtonRef.current?.focus());
  }

  function chooseConcern(value: string) {
    setSelectedConcern(value);
    setView("filters");
    window.requestAnimationFrame(() => concernButtonRef.current?.focus());
  }

  function returnFromNestedView() {
    const previous = view;
    setView("filters");
    window.requestAnimationFrame(() =>
      previous === "concerns"
        ? concernButtonRef.current?.focus()
        : companyButtonRef.current?.focus(),
    );
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape" && view !== "filters") {
      event.preventDefault();
      event.stopPropagation();
      returnFromNestedView();
      return;
    }
    if (event.key !== "Tab") return;
    const visibleView =
      view === "companies"
        ? companyViewRef.current
        : view === "concerns"
          ? concernViewRef.current
          : filterViewRef.current;
    if (!visibleView) return;
    const focusable = Array.from(
      visibleView.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((item) => !item.closest("[hidden]"));
    event.stopPropagation();
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (active === first || !visibleView.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (active === last || !visibleView.contains(active))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderRefinementGroup(group: InventoryRefinementGroup): ReactNode {
    switch (group) {
      case "source":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Source</legend>
            <div className={styles.options}>
              {sourceOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="review"
                    value={value}
                    defaultChecked={filters.review === value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "category":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Category</legend>
            <div className={styles.options}>
              <label>
                <input
                  type="radio"
                  name="category"
                  value="All"
                  defaultChecked={filters.category === "All"}
                />
                <span>All</span>
              </label>
              {categoryOptions.map(
                ({
                  value,
                  count,
                }: {
                  value: ExternalCatalogueCategory;
                  count: number;
                }) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="category"
                      value={value}
                      defaultChecked={filters.category === value}
                    />
                    <span>
                      {value} · {count}
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
        );
      case "routine":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Routine</legend>
            <div className={styles.options}>
              <label>
                <input
                  type="radio"
                  name="step"
                  value=""
                  defaultChecked={!filters.step}
                />
                <span>Any step</span>
              </label>
              {stepOptions.map(({ value, count }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="step"
                    value={value}
                    defaultChecked={filters.step === value}
                  />
                  <span>
                    {value} · {count}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "company":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Brand</legend>
            <button
              className={styles.companyField}
              type="button"
              ref={companyButtonRef}
              onClick={showCompanies}
            >
              <span>Brand</span>
              <strong>{selectedBrand || "Any brand"}</strong>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </fieldset>
        );
      case "concern":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Concern</legend>
            <button
              className={styles.companyField}
              type="button"
              ref={concernButtonRef}
              onClick={showConcerns}
            >
              <span>Concern</span>
              <strong>{selectedConcernLabel || "Any concern"}</strong>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </fieldset>
        );
      case "availability":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Store information</legend>
            <p className={styles.sectionHint}>
              Only fresh, exact prices count.
            </p>
            <div className={styles.options}>
              <label>
                <input
                  type="radio"
                  name="availability"
                  value="all"
                  defaultChecked={filters.availability === "all"}
                />
                <span>Any listing</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="availability"
                  value="priced"
                  defaultChecked={filters.availability === "priced"}
                />
                <span>Fresh price · {facets.priced}</span>
              </label>
            </div>
          </fieldset>
        );
      case "price":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Price</legend>
            <div className={styles.options}>
              <label>
                <input
                  type="radio"
                  name="price"
                  value="all"
                  defaultChecked={filters.price === "all"}
                />
                <span>Any price</span>
              </label>
              {priceOptions.map(([value, label, count]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="price"
                    value={value}
                    defaultChecked={filters.price === value}
                  />
                  <span>
                    {label} · {count}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "order":
        return (
          <fieldset data-refinement-group={group} key={group}>
            <legend>Order</legend>
            <div className={styles.options}>
              {(
                [
                  ["featured", "Catalogue order"],
                  ["name", "Name"],
                  ["newest", "Recently updated"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="sort"
                    value={value}
                    defaultChecked={filters.sort === value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
    }
  }

  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        ref={triggerRef}
        onClick={openSheet}
      >
        <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />{" "}
        Filter
        {activeCount ? (
          <span className={styles.activeCount}>{activeCount}</span>
        ) : null}
      </button>
      <dialog
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          view === "companies"
            ? "catalogue-company-title"
            : view === "concerns"
              ? "catalogue-concern-title"
              : "catalogue-filter-title"
        }
        tabIndex={-1}
        onCancel={(event) => {
          if (view !== "filters") {
            event.preventDefault();
            returnFromNestedView();
          }
        }}
        onKeyDownCapture={handleDialogKeyDown}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeSheet();
        }}
      >
        <form
          className={styles.sheet}
          action="/products#all-products"
          method="get"
          ref={formRef}
        >
          <input type="hidden" name="brand" value={selectedBrand} />
          <input type="hidden" name="concern" value={selectedConcern} />
          <input type="hidden" name="market" value={market} />
          <input type="hidden" name="browse" value={browse} />
          {filters.q ? (
            <input type="hidden" name="q" value={filters.q} />
          ) : null}

          <div
            className={styles.view}
            hidden={view !== "filters"}
            ref={filterViewRef}
          >
            <header>
              <div>
                <small>Catalogue</small>
                <h2 id="catalogue-filter-title">Refine the shelf.</h2>
                <p>{total.toLocaleString()} shown now.</p>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </header>

            {refinementPlan.primary.map(renderRefinementGroup)}
            {!refinementPlan.primary.length ? (
              <p className={styles.specificNote}>
                This shelf is already specific.
              </p>
            ) : null}
            {refinementPlan.secondary.length ? (
              <button
                className={styles.disclosure}
                type="button"
                aria-expanded={showAllRefinements}
                aria-controls="catalogue-all-refinements"
                onClick={() => setShowAllRefinements((current) => !current)}
              >
                {showAllRefinements ? "Show fewer" : "All refinements"}
                <ChevronDown size={17} aria-hidden="true" />
              </button>
            ) : null}
            {refinementPlan.secondary.length ? (
              <div
                className={styles.secondaryGroups}
                id="catalogue-all-refinements"
                hidden={!showAllRefinements}
              >
                {refinementPlan.secondary.map(renderRefinementGroup)}
              </div>
            ) : null}

            <footer>
              <Link href={resetHref}>Clear all</Link>
              <button type="submit">Apply filters</button>
            </footer>
          </div>

          <div
            className={styles.view}
            hidden={view !== "companies"}
            ref={companyViewRef}
          >
            <header className={styles.companyHeader}>
              <button
                type="button"
                onClick={returnFromNestedView}
                aria-label="Back to filters"
              >
                <ArrowLeft size={19} />
              </button>
              <div>
                <small>Filter</small>
                <h2 id="catalogue-company-title">Brand</h2>
                <p>{companies.total.toLocaleString()} found.</p>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </header>
            <label className={styles.companySearch}>
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search brands</span>
              <input
                ref={companySearchRef}
                value={companyQuery}
                onChange={(event) => setCompanyQuery(event.target.value)}
                placeholder="Search brands"
                autoComplete="off"
              />
            </label>
            <div className={styles.companyList} aria-label="Brands">
              <button
                type="button"
                aria-pressed={!selectedBrand}
                className={!selectedBrand ? styles.companySelected : ""}
                onClick={() => chooseCompany("")}
              >
                <span>Any brand</span>
                {!selectedBrand ? <Check size={16} aria-hidden="true" /> : null}
              </button>
              {companies.items.map((company) => (
                <button
                  data-company-option
                  type="button"
                  aria-pressed={selectedBrand === company.value}
                  className={
                    selectedBrand === company.value
                      ? styles.companySelected
                      : ""
                  }
                  onClick={() => chooseCompany(company.value)}
                  key={company.value}
                >
                  <span>
                    <strong>{company.value}</strong>
                    <small>
                      {company.count}{" "}
                      {company.count === 1 ? "product" : "products"}
                    </small>
                  </span>
                  {selectedBrand === company.value ? (
                    <Check size={16} aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
            {!companies.items.length ? (
              <p className={styles.companyEmpty}>No brand found.</p>
            ) : null}
          </div>

          <div
            className={styles.view}
            hidden={view !== "concerns"}
            ref={concernViewRef}
          >
            <header className={styles.companyHeader}>
              <button
                type="button"
                onClick={returnFromNestedView}
                aria-label="Back to filters"
              >
                <ArrowLeft size={19} />
              </button>
              <div>
                <small>Filter</small>
                <h2 id="catalogue-concern-title">Concern</h2>
                <p>Browse reviewed context.</p>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </header>
            <p className={styles.concernNote}>
              Profiles, not treatment advice.
            </p>
            <div className={styles.companyList} aria-label="Product concerns">
              <button
                type="button"
                aria-pressed={!selectedConcern}
                className={!selectedConcern ? styles.companySelected : ""}
                onClick={() => chooseConcern("")}
              >
                <span>Any concern</span>
                {!selectedConcern ? (
                  <Check size={16} aria-hidden="true" />
                ) : null}
              </button>
              {productConcerns.map((concern) => (
                <button
                  type="button"
                  aria-pressed={selectedConcern === concern.value}
                  className={
                    selectedConcern === concern.value
                      ? styles.companySelected
                      : ""
                  }
                  onClick={() => chooseConcern(concern.value)}
                  key={concern.value}
                >
                  <span>
                    <strong>{concern.label}</strong>
                    <small>
                      {concern.count}{" "}
                      {concern.count === 1 ? "profile" : "profiles"} now
                    </small>
                  </span>
                  {selectedConcern === concern.value ? (
                    <Check size={16} aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
            {guideOnlyConcerns.length ? (
              <div className={styles.guideOnly}>
                <p>Guides without a matched profile</p>
                {guideOnlyConcerns.map((concern) => (
                  <Link href={`/concerns/${concern.value}`} key={concern.value}>
                    <span>{concern.label}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : null}
            <Link className={styles.allGuides} href="/concerns">
              All concern guides <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </form>
      </dialog>
    </>
  );
}
