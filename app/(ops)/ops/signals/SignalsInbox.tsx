'use client';

import type { CommerceSignal } from '@/lib/moderation/queues';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { InboxContainer } from '@/components/ops/inbox/InboxContainer';
import styles from '@/components/ops/inbox/inbox.module.css';

interface SignalsInboxProps {
  rows: CommerceSignal[];
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
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--linear-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Target Product Reference
              </div>
              <ProductRef subject={product} />
            </div>

            {/* Properties Grid */}
            <div className={styles.propertiesSection} style={{ borderTop: '1px solid var(--linear-border)', paddingTop: '12px' }}>
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

            <p style={{ fontSize: '11px', color: 'var(--linear-text-muted)', borderTop: '1px solid var(--linear-border)', paddingTop: '12px', margin: 0, fontStyle: 'italic' }}>
              Commerce signals are read-only metrics stored immutably to audit search/click attribution.
            </p>
          </div>
        );
      }}
    />
  );
}
