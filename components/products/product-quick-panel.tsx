'use client';

import { ArrowUpRight, Info, ShoppingBag, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { Offer } from '@/data/products';
import { nigeriaRetailers } from '@/data/retailers';
import type { ProductPriceTrends } from '@/modules/commerce/price-trends';
import { RetailerList } from '@/components/commerce/retailer-list';

type PanelTab = 'buy' | 'stores' | 'details';
type Ingredient = { id: string; label: string; sourceUrl?: string };
type RoutineStep = { title: string; detail: string };

type ProductQuickPanelProps = {
  productSlug: string;
  productName: string;
  offers: Offer[];
  priceTrends?: ProductPriceTrends;
  bestFor: string[];
  usage: string;
  evidence: string;
  caution: string;
  ingredients: Ingredient[];
  routine: RoutineStep[];
};

const tabs: Array<{ id: PanelTab; label: string }> = [
  { id: 'buy', label: 'Buy' },
  { id: 'stores', label: 'More stores' },
  { id: 'details', label: 'Details' },
];

export function ProductQuickPanel(props: ProductQuickPanelProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<PanelTab>('buy');
  const [open, setOpen] = useState(false);
  const exactRetailers = new Set(props.offers.filter(offer => offer.match !== 'search').map(offer => offer.retailer));
  const moreStores = nigeriaRetailers.filter(store => !exactRetailers.has(store.name));

  function openPanel(nextTab: PanelTab, opener: HTMLButtonElement) {
    setTab(nextTab);
    openerRef.current = opener;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    setOpen(true);
  }

  function closePanel() {
    dialogRef.current?.close();
  }

  function finishClose() {
    setOpen(false);
    openerRef.current?.focus();
  }

  return (
    <>
      <div className="product-quick-actions" aria-label="Product actions">
        <button type="button" onClick={event => openPanel('buy', event.currentTarget)} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open && tab === 'buy'}>
          <ShoppingBag size={18} aria-hidden="true" /> Buy options
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
            <button type="button" onClick={closePanel} aria-label="Close product panel"><X size={20} aria-hidden="true" /></button>
          </header>

          <div className="product-panel-tabs" role="tablist" aria-label="Product panel sections">
            {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
          </div>

          <div className="product-panel-body" tabIndex={0}>
            {tab === 'buy' ? <section className="product-panel-buy" role="tabpanel">
              <RetailerList offers={props.offers} productSlug={props.productSlug} priceTrends={props.priceTrends}/>
              <p className="affiliate-note">Some links earn commission. Ranking stays independent.</p>
            </section> : null}

            {tab === 'stores' ? <section className="product-panel-stores" role="tabpanel">
              {moreStores.map(store => <a key={store.name} href={`/go?product=${encodeURIComponent(props.productSlug)}&retailer=${encodeURIComponent(store.name)}`}>
                <span><strong>{store.name}</strong><small>{store.kind === 'marketplace' ? 'Marketplace' : 'Retailer'}</small></span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>)}
            </section> : null}

            {tab === 'details' ? <section className="product-panel-details" role="tabpanel">
              <div><p className="eyebrow">Best for</p><div className="product-panel-chips">{props.bestFor.map(item => <span key={item}>{item}</span>)}</div></div>
              <div><p className="eyebrow">Use</p><p>{props.usage}</p></div>
              <div><p className="eyebrow">What we know</p><p>{props.evidence}</p></div>
              <div className="product-panel-caution"><p className="eyebrow">Keep in mind</p><p>{props.caution}</p></div>
              <div><p className="eyebrow">Key ingredients</p>{props.ingredients.length ? <div className="product-panel-chips">{props.ingredients.map(ingredient => ingredient.sourceUrl ? <a key={ingredient.id} href={ingredient.sourceUrl} target="_blank" rel="noreferrer">{ingredient.label}<ArrowUpRight size={13} aria-hidden="true" /></a> : <span key={ingredient.id}>{ingredient.label}</span>)}</div> : <p>Check the pack before use.</p>}</div>
              <div><p className="eyebrow">Routine</p><div className="product-panel-routine">{props.routine.map((item, index) => <div key={`${item.title}-${index}`}><span>0{index + 1}</span><p><strong>{item.title}</strong><small>{item.detail}</small></p></div>)}</div></div>
            </section> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
