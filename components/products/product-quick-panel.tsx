"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Info,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { RetailerList } from "@/components/commerce/retailer-list";
import { ShareButton } from "@/components/share/share-button";
import { useControlledDialog } from "@/components/ui/use-controlled-dialog";
import { nigeriaRetailers } from "@/data/retailers";
import type {
  ProductPanelData,
  ProductPanelTab,
} from "@/lib/catalogue/product-panel-model";
import { ingredientLibraryHref } from "@/lib/clinical/care-context-links";
import { hasListingEvidence } from "@/modules/commerce/offer-evidence";
import { hasShareableNgOffer } from "@/modules/commerce/shareable-offer";

export type {
  ProductPanelData,
  ProductPanelTab,
} from "@/lib/catalogue/product-panel-model";

export type ProductQuickPanelSheetProps = {
  data: ProductPanelData;
  open: boolean;
  tab: ProductPanelTab;
  onTabChange: (tab: ProductPanelTab) => void;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  dialogId?: string;
};

const tabs: Array<{ id: ProductPanelTab; label: string }> = [
  { id: "buy", label: "Prices" },
  { id: "stores", label: "Search" },
  { id: "details", label: "Details" },
];

function focusableElements(dialog: HTMLDialogElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") && !element.closest("[hidden]"),
  );
}

export function ProductQuickPanelSheet({
  data,
  open,
  tab,
  onTabChange,
  onClose,
  restoreFocusRef,
  dialogId: providedDialogId,
}: ProductQuickPanelSheetProps) {
  const generatedDialogId = useId();
  const dialogId = providedDialogId ?? generatedDialogId;
  const tabRefs = useRef<
    Partial<Record<ProductPanelTab, HTMLButtonElement | null>>
  >({});
  const closeRequestedRef = useRef(false);

  const { dialogRef } = useControlledDialog({
    open,
    onClose,
    restoreFocusRef,
  });

  const exactRetailers = new Set(
    data.offers.filter(hasListingEvidence).map((offer) => offer.retailer),
  );
  const shareable = hasShareableNgOffer({ offers: data.offers });
  const moreStores = nigeriaRetailers.filter(
    (store) => !exactRetailers.has(store.name),
  );
  const [storeQuery, setStoreQuery] = useState("");
  const [showAllStores, setShowAllStores] = useState(false);
  const INITIAL_STORE_PREVIEW = 8;
  const filteredStores = storeQuery.trim()
    ? moreStores.filter((store) =>
        store.name.toLowerCase().includes(storeQuery.toLowerCase().trim()),
      )
    : moreStores;
  const visibleStores =
    showAllStores || storeQuery.trim()
      ? filteredStores
      : filteredStores.slice(0, INITIAL_STORE_PREVIEW);
  const hiddenStoreCount = filteredStores.length - visibleStores.length;

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    onClose();
  }, [onClose]);

  const handlePanelBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) requestClose();
    },
    [requestClose],
  );

  const handlePanelCancel = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      requestClose();
    },
    [requestClose],
  );

  useEffect(() => {
    if (!open) return;
    closeRequestedRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => {
      tabRefs.current[tab]?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open, tab]);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ProductPanelTab,
  ) {
    const currentIndex = tabs.findIndex((item) => item.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    onTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }

    const dialog = dialogRef.current;
    if (event.key !== "Tab" || dialog?.dataset.fallbackModal !== "true") return;

    const focusable = dialog ? focusableElements(dialog) : [];
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      className="product-panel-dialog"
      id={dialogId}
      ref={dialogRef}
      aria-labelledby={`${dialogId}-title`}
      aria-modal="true"
      onCancel={handlePanelCancel}
      onKeyDown={handleDialogKeyDown}
      onClick={handlePanelBackdropClick}
    >
      <div className="product-panel-frame">
        <span className="product-panel-handle" aria-hidden="true" />
        <header className="product-panel-header">
          <div>
            <p className="eyebrow">
              {tab === "details" ? "Product guide" : "Nigeria"}
            </p>
            <h2 id={`${dialogId}-title`}>{data.productName}</h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close product information"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div
          className="product-panel-tabs"
          role="tablist"
          aria-label="Product information"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              id={`${dialogId}-tab-${item.id}`}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
              type="button"
              role="tab"
              tabIndex={tab === item.id ? 0 : -1}
              aria-selected={tab === item.id}
              aria-controls={`${dialogId}-panel-${item.id}`}
              onClick={() => onTabChange(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="product-panel-body">
          <section
            className="product-panel-buy"
            id={`${dialogId}-panel-buy`}
            role="tabpanel"
            aria-labelledby={`${dialogId}-tab-buy`}
            tabIndex={0}
            hidden={tab !== "buy"}
          >
            <RetailerList
              offers={data.offers}
              productSlug={data.productSlug}
              priceTrends={data.priceTrends}
              marketSnapshot={data.marketSnapshot}
              footer={
                shareable ? (
                  <ShareButton
                    path={`/share/${data.productSlug}`}
                    title={data.productName}
                    label="Share"
                    inline
                  />
                ) : null
              }
            />
          </section>

          <section
            className="product-panel-stores"
            id={`${dialogId}-panel-stores`}
            role="tabpanel"
            aria-labelledby={`${dialogId}-tab-stores`}
            tabIndex={0}
            hidden={tab !== "stores"}
          >
            <div className="product-panel-stores-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Filter stores…"
                value={storeQuery}
                onChange={(e) => {
                  setStoreQuery(e.target.value);
                  setShowAllStores(false);
                }}
                aria-label="Filter stores by name"
              />
            </div>
            {visibleStores.map((store) => (
              <a
                key={store.name}
                href={`/go?product=${encodeURIComponent(data.productSlug)}&retailer=${encodeURIComponent(store.name)}`}
              >
                <span>
                  <strong>{store.name}</strong>
                  <small>
                    {store.kind === "marketplace"
                      ? "Marketplace search"
                      : "Search only"}
                  </small>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            ))}
            {hiddenStoreCount > 0 ? (
              <button
                type="button"
                className="product-panel-stores-more"
                onClick={() => setShowAllStores(true)}
              >
                Show {hiddenStoreCount} more{" "}
                {hiddenStoreCount === 1 ? "store" : "stores"}
              </button>
            ) : null}
            {filteredStores.length === 0 && storeQuery.trim() ? (
              <p className="product-panel-stores-empty">
                No stores matching &quot;{storeQuery.trim()}&quot;.
              </p>
            ) : null}
          </section>

          <section
            className="product-panel-details"
            id={`${dialogId}-panel-details`}
            role="tabpanel"
            aria-labelledby={`${dialogId}-tab-details`}
            tabIndex={0}
            hidden={tab !== "details"}
          >
            <div className="product-panel-caution">
              <p className="eyebrow">Profile</p>
              <p>{data.careNote}</p>
            </div>
            {data.ingredients.length ? (
              <div>
                <p className="eyebrow">Key ingredients</p>
                <div className="product-panel-chips">
                  {data.ingredients.map((ingredient) => {
                    const libraryHref = ingredientLibraryHref(ingredient.slug);
                    if (libraryHref)
                      return (
                        <Link
                          key={ingredient.id}
                          href={libraryHref}
                          onClick={onClose}
                        >
                          {ingredient.label}
                          <ArrowRight size={13} aria-hidden="true" />
                        </Link>
                      );
                    return ingredient.sourceUrl ? (
                      <a
                        key={ingredient.id}
                        href={ingredient.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ingredient.label}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      <span key={ingredient.id}>{ingredient.label}</span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div>
              <p className="eyebrow">How to use</p>
              <p>{data.usage}</p>
            </div>
            {data.routine.length ? (
              <div>
                <p className="eyebrow">Routine</p>
                <div className="product-panel-routine">
                  {data.routine.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </dialog>
  );
}

export function ProductQuickPanel(data: ProductPanelData) {
  const dialogId = useId();
  const openerRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState<ProductPanelTab>("buy");
  const [open, setOpen] = useState(false);

  function openPanel(nextTab: ProductPanelTab, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setTab(nextTab);
    setOpen(true);
  }

  return (
    <>
      <div className="product-quick-actions" aria-label="Product actions">
        <button
          type="button"
          onClick={(event) => openPanel("buy", event.currentTarget)}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-expanded={open && tab === "buy"}
        >
          <ShoppingBag size={18} aria-hidden="true" /> Find a store
        </button>
        <button
          type="button"
          onClick={(event) => openPanel("details", event.currentTarget)}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-expanded={open && tab === "details"}
        >
          <Info size={18} aria-hidden="true" /> Details
        </button>
      </div>

      <ProductQuickPanelSheet
        data={data}
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
        restoreFocusRef={openerRef}
        dialogId={dialogId}
      />
    </>
  );
}
