'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { Market } from '@/data/prices';
import type { Offer, Product } from '@/data/products';
import { landedCostCaveat, observedMarketPrice } from '@/modules/commerce/offer-evidence';
import { currentPricedOfferCount, searchResultOffers } from '@/modules/commerce/search-result-offers';
import { SafeProductImage } from './safe-product-image';
import styles from './product-search-results.module.css';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function price(offer: Offer, market: Market) {
  if (!offer.available) return 'Out of stock';
  const amount = observedMarketPrice(offer, market);
  if (amount == null) return 'Check price';
  return market === 'NG' ? naira.format(amount) : dollars.format(amount);
}

function checked(value?: string) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}/.test(value)
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

export function ProductSearchResults({ products, market }: { products: Product[]; market: Market }) {
  return (
    <div className={styles.results}>
      {products.map(product => {
        const href = `/products/${product.slug}`;
        const offers = searchResultOffers(product, market);
        const priced = currentPricedOfferCount(offers, market);

        return (
          <article className={styles.result} key={product.slug}>
            <Link className={styles.visual} href={href} aria-label={`${product.brand} ${product.name}`}>
              <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
            </Link>

            <div className={styles.product}>
              <p className="eyebrow">{product.brand}</p>
              <h2><Link href={href}>{product.name}</Link></h2>
              <p className={styles.meta}>{product.size} · {product.displayLine}</p>
              <div className={styles.tags}>{product.bestFor.slice(0, 3).map(item => <span key={item}>{item}</span>)}</div>
              <Link className={styles.details} href={href}>Product details <ArrowUpRight size={16}/></Link>
            </div>

            <div className={styles.comparison}>
              <div className={styles.comparisonHeading}>
                <span>{market === 'NG' ? 'Nigeria' : 'United States'}</span>
                <strong>{priced ? `${priced} ${priced === 1 ? 'price' : 'prices'}` : offers.length ? `${offers.length} ${offers.length === 1 ? 'store' : 'stores'}` : 'No current offers'}</strong>
              </div>
              {offers.length ? <div className={styles.offerList}>{offers.map(offer => {
                const checkedAt = checked(offer.priceObservation?.observedAt ?? offer.checkedAt);
                return (
                  <a href={`/go?product=${encodeURIComponent(product.slug)}&retailer=${encodeURIComponent(offer.retailer)}`} key={`${offer.retailer}-${offer.url}`}>
                    <span><strong>{offer.retailer}</strong><small>{checkedAt ? `Observed ${checkedAt} · ${landedCostCaveat(offer)}` : 'Check listing'}</small>{offer.priceComparison === 'exclude' ? <small>Marketplace price · not compared</small> : null}</span>
                    <span className={styles.offerPrice}>{price(offer, market)}<ArrowUpRight size={15}/></span>
                  </a>
                );
              })}</div> : <div className={styles.pending}><span>Prices pending.</span><Link href={href}>Check stores</Link></div>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
