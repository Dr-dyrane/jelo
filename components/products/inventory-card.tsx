import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { Market } from '@/data/prices';
import type { InventoryItem } from '@/lib/catalogue/inventory-repository';
import { MarketPrice } from './market-price';
import { SafeProductImage } from './safe-product-image';
import styles from './inventory-card.module.css';

function sourceDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export function InventoryCard({ item, market }: { item: InventoryItem; market: Market }) {
  const shared = item.external ? { target: '_blank', rel: 'noreferrer' } : {};
  const updated = item.sourceUpdatedAt ? sourceDate(item.sourceUpdatedAt) : null;

  return (
    <article className={styles.card}>
      <Link className={styles.link} href={item.href} aria-label={`${item.brand} ${item.name}`} {...shared}>
        <div className={styles.visual}>
          <SafeProductImage src={item.image} alt={`${item.brand} ${item.name}`} />
        </div>
        <div className={styles.copy}>
          <p>{item.brand}</p>
          <h3>{item.name}</h3>
          <div className={styles.meta}>
            <span>{item.quantity}</span>
            {item.kind === 'reviewed' ? <span><MarketPrice offers={item.offers} market={market} /></span> : null}
          </div>
          {item.kind === 'community' ? <span className={styles.action}>
            View source <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </span> : null}
          {updated ? <small>Source updated {updated}</small> : null}
        </div>
      </Link>
    </article>
  );
}
