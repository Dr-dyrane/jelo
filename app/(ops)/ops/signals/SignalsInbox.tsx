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
          <div className={styles.row} style={{ width: '100%', background: 'transparent' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                Target Product Reference
              </h3>
              <ProductRef subject={product} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
              fontSize: 'var(--text-cell)',
              background: 'var(--tag-bg)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-control)',
            }}>
              <div><strong>Event Type:</strong> {row.eventType}</div>
              <div><strong>Retailer:</strong> {row.retailer} ({row.market})</div>
              <div>
                <strong>Observed Price:</strong>{' '}
                {row.priceNgn != null ? (
                  <span className={styles.value}>{money(row.priceNgn)}</span>
                ) : (
                  '—'
                )}
              </div>
              <div>
                <strong>Price Rank:</strong>{' '}
                {row.priceRank ? (
                  <StatusPill tone="success">{row.priceRank}</StatusPill>
                ) : (
                  '—'
                )}
              </div>
              <div><strong>Rank Position:</strong> {row.position}</div>
              <div><strong>Freshness:</strong> {row.freshnessDays != null ? `${row.freshnessDays} days` : '—'}</div>
              <div><strong>Recorded:</strong> <RelativeTime iso={row.createdAt} /></div>
              <div><strong>Signal ID:</strong> <IdChip value={row.id} label="sig" /></div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 'var(--space-2) 0 0', fontStyle: 'italic' }}>
              Commerce signals are read-only metrics stored immutably to audit search/click attribution.
            </p>
          </div>
        );
      }}
    />
  );
}
