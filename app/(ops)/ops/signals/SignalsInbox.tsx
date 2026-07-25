'use client';

import type { CommerceSignal } from '@/lib/moderation/queues';
import type { Product } from '@/data/products';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import styles from '@/components/ops/inbox/inbox.module.css';

export interface EnrichedCommerceSignal extends CommerceSignal {
  product?: Product;
}

interface SignalsInboxProps {
  rows: EnrichedCommerceSignal[];
}

export function SignalsInbox({ rows }: SignalsInboxProps) {
  return (
    <InboxContainer
      items={rows}
      itemTypeLabel="commerce signal"
      renderItemRow={(row) => {
        const product = humanizeRef(`product:${row.productSlug}`);
        return (
          <div className={styles.row} style={{ width: '100%', background: 'transparent', borderBottom: 0 }}>
            <div className={styles.subject}>
              <ProductRef subject={product} />
              <div className={styles.metaRow}>
                <StatusPill tone="info">{row.eventType}</StatusPill>
                <RelativeTime iso={row.createdAt} />
              </div>
            </div>
          </div>
        );
      }}
      renderItemDetails={(row) => {
        const product = humanizeRef(`product:${row.productSlug}`);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                Target Product Reference
              </div>
              <ProductRef subject={product} />
              {row.product ? (
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  background: 'var(--card)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--elevation-1)',
                  marginTop: '6px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    position: 'relative',
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-control)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <SafeProductImage
                      src={row.product.image || '/product-placeholder.svg'}
                      alt={row.product.name}
                      className=""
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                    <strong style={{ fontSize: '11px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {row.product.brand} {row.product.name}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      Category: {row.product.category} · Size: {row.product.size}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Event Type</span>
                <span className={styles.propertyValue}><StatusPill tone="info">{row.eventType}</StatusPill></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Retailer</span>
                <span className={styles.propertyValue}>{row.retailer}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Market</span>
                <span className={styles.propertyValue}>{row.market}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Price</span>
                <span className={styles.propertyValue}>
                  {row.priceNgn != null ? (
                    <span className={styles.value}>{money(row.priceNgn)}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Price Rank</span>
                <span className={styles.propertyValue}>
                  {row.priceRank ? (
                    <StatusPill tone="success">{row.priceRank}</StatusPill>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Rank Pos</span>
                <span className={styles.propertyValue}>{row.position}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Freshness</span>
                <span className={styles.propertyValue}>{row.freshnessDays != null ? `${row.freshnessDays} days` : '—'}</span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Recorded</span>
                <span className={styles.propertyValue}><RelativeTime iso={row.createdAt} /></span>
              </div>
              <div className={styles.propertyRow}>
                <span className={styles.propertyLabel}>Signal ID</span>
                <span className={styles.propertyValue}><IdChip value={row.id} label="sig" /></span>
              </div>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px', margin: 0, fontStyle: 'italic' }}>
              Commerce signals are read-only metrics stored immutably to audit search/click attribution.
            </p>
          </div>
        );
      }}
    />
  );
}
