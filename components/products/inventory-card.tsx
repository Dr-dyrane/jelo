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
  const careLabel = item.kind !== 'reviewed' ? null
    : item.careState === 'supportive_eligible' ? 'Supportive use'
      : item.careState === 'pharmacist_review' ? 'Needs pharmacist review'
        : 'Care review pending';

  return (
    <article className={styles.card}>
      <Link className={styles.visual} href={item.href} aria-label={`${item.brand} ${item.name}`} {...shared}>
        <SafeProductImage src={item.image} alt={`${item.brand} ${item.name}`} />
        {item.kind === 'community' ? <span className={styles.status}>{item.label}</span> : null}
        {careLabel ? <span className={styles.status}>{careLabel}</span> : null}
        {item.kind === 'reviewed' ? <span className={styles.price}><MarketPrice offers={item.offers} market={market} /></span> : null}
      </Link>
      <div className={styles.copy}>
        <p>{item.brand}</p>
        <h3><Link href={item.href} {...shared}>{item.name}</Link></h3>
        <div className={styles.meta}><span>{item.quantity}</span><span>{item.category}</span></div>
        {item.kind === 'community' ? <Link className={styles.action} href={item.href} {...shared}>
          View source <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
        </Link> : null}
        {updated ? <small>Source updated {updated}</small> : null}
      </div>
    </article>
  );
}
