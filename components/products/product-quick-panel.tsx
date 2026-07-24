'use client';

import { ArrowUpRight, Info, ShoppingBag, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { Offer } from '@/data/products';
import { nigeriaRetailers } from '@/data/retailers';
import type { ProductPriceTrends } from '@/modules/commerce/price-trends';
import { hasListingEvidence } from '@/modules/commerce/offer-evidence';
import { hasShareableNgOffer } from '@/modules/commerce/shareable-offer';
import { RetailerList } from '@/components/commerce/retailer-list';
import { ShareButton } from '@/components/share/share-button';

type PanelTab = 'buy' | 'stores' | 'details';
type Ingredient = { id: string; label: string; sourceUrl?: string };
type RoutineStep = { title: string; detail: string };

type ProductQuickPanelProps = {
  productSlug: string;
  productName: string;
  offers: Offer[];
  priceTrends?: ProductPriceTrends;
  careNote: string;
  usage: string;
  ingredients: Ingredient[];
  routine: RoutineStep[];
};

const tabs: Array<{ id: PanelTab; label: string }> = [
  { id: 'buy', label: 'Prices' },
  { id: 'stores', label: 'Search' },
  { id: 'details', label: 'Details' },
];

export function ProductQuickPanel(props: ProductQuickPanelProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<PanelTab>('buy');
  const [open, setOpen] = useState(false);
  const exactRetailers = new Set(props.offers.filter(hasListingEvidence).map(offer => offer.retailer));
  const shareable = hasShareableNgOffer({ offers: props.offers });
  const moreStores = nigeriaRetailers.filter(store => !exactRetailers.has(store.name));

  function openPanel(nextTab: PanelTab, opener: HTMLButtonElement) {
    setTab(nextTab);
    openerRef.current = opener;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      try {
        dialog.showModal?.();
      } catch {
        // Fall back below when an embedded browser only partially supports dialog.
      }
      if (!dialog.hasAttribute('open')) {
        dialog.dataset.fallbackModal = 'true';
        dialog.setAttribute('open', '');
      }
    }
    setOpen(true);
  }

  function closePanel() {
    const dialog = dialogRef.current;
    if (!dialog?.hasAttribute('open')) return;
    if (dialog.dataset.fallbackModal !== 'true') {
      try {
        dialog.close();
        return;
      } catch {
        // Fall through to the attribute-based close.
      }
    }
    dialog.removeAttribute('open');
    delete dialog.dataset.fallbackModal;
    finishClose();
  }

  function finishClose() {
    setOpen(false);
    openerRef.current?.focus();
  }

  return (
    <>
      <div className="product-quick-actions" aria-label="Product actions">
        <button type="button" onClick={event => openPanel('buy', event.currentTarget)} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open && tab === 'buy'}>
          <ShoppingBag size={18} aria-hidden="true" /> Find a store
        </button>
        <button type="button" onClick={event => openPanel('details', event.currentTarget)} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open && tab === 'details'}>
          <Info size={18} aria-hidden="true" /> Details
        </button>
      </div>

      <dialog
        className="product-panel-dialog"
        id={dialogId}
        ref={dialogRef}
        aria-labelledby={`${dialogId}-title`}
        onClose={finishClose}
        onClick={event => {
          if (event.target === event.currentTarget) closePanel();
        }}
      >
        <div className="product-panel-frame">
          <span className="product-panel-handle" aria-hidden="true" />
          <header className="product-panel-header">
            <div><p className="eyebrow">{tab === 'details' ? 'Product guide' : 'Nigeria'}</p><h2 id={`${dialogId}-title`}>{props.productName}</h2></div>
            <button type="button" onClick={closePanel} aria-label="Close"><X size={20} aria-hidden="true" /></button>
          </header>

          <div className="product-panel-tabs" role="tablist" aria-label="Product information">
            {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
          </div>

          <div className="product-panel-body" tabIndex={0}>
            {tab === 'buy' ? <section className="product-panel-buy" role="tabpanel">
              <RetailerList
                offers={props.offers}
                productSlug={props.productSlug}
                priceTrends={props.priceTrends}
                footer={shareable ? <ShareButton path={`/share/${props.productSlug}`} title={props.productName} label="Share" inline /> : null}
              />
            </section> : null}

            {tab === 'stores' ? <section className="product-panel-stores" role="tabpanel">
              {moreStores.map(store => <a key={store.name} href={`/go?product=${encodeURIComponent(props.productSlug)}&retailer=${encodeURIComponent(store.name)}`}>
                <span><strong>{store.name}</strong><small>{store.kind === 'marketplace' ? 'Marketplace search' : 'Search only'}</small></span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>)}
            </section> : null}

            {tab === 'details' ? <section className="product-panel-details" role="tabpanel">
              <div className="product-panel-caution"><p className="eyebrow">Profile</p><p>{props.careNote}</p></div>
              {props.ingredients.length ? <div><p className="eyebrow">Key ingredients</p><div className="product-panel-chips">{props.ingredients.map(ingredient => ingredient.sourceUrl ? <a key={ingredient.id} href={ingredient.sourceUrl} target="_blank" rel="noreferrer">{ingredient.label}<ArrowUpRight size={13} aria-hidden="true" /></a> : <span key={ingredient.id}>{ingredient.label}</span>)}</div></div> : null}
              <div><p className="eyebrow">How to use</p><p>{props.usage}</p></div>
              {props.routine.length ? <div><p className="eyebrow">Routine</p><div className="product-panel-routine">{props.routine.map((item, index) => <div key={`${item.title}-${index}`}><span>0{index + 1}</span><p><strong>{item.title}</strong><small>{item.detail}</small></p></div>)}</div></div> : null}
            </section> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
