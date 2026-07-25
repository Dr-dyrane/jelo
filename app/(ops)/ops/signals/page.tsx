import { getPostgresClient } from '@/lib/db/postgres';
import { listCommerceSignals } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { humanizeRef } from '@/lib/humanize/refs';
import { money } from '@/lib/format/money';
import { ProductRef } from '@/components/ops/chips/ProductRef';
import { StatusPill } from '@/components/ops/chips/StatusPill';
import { RelativeTime } from '@/components/ops/chips/RelativeTime';
import { IdChip } from '@/components/ops/chips/IdChip';
import { EmptyState } from '@/components/ops/state/EmptyState';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function SignalsView() {
  await requireConsoleOperator();
  const rows = await listCommerceSignals(getPostgresClient(), LIMIT);

  return (
    <>
      <h1 className={opsStyles.h1}>Commerce signals</h1>
      <p className={opsStyles.lede}>store_click measurement, read-only. Never joined to health-shaped behaviour and never an input to store ranking (ADR 0006).</p>

      {rows.length === 0 ? (
        <EmptyState
          title="No commerce signals"
          body="Shopper click interactions will be displayed here as signals accumulate."
        />
      ) : (
        <>
          <div className={styles.card}>
            {rows.map(row => {
              const product = humanizeRef(`product:${row.productSlug}`);

              return (
                <div key={row.id} className={styles.row}>
                  <div className={styles.subject}>
                    <ProductRef subject={product} />
                    <div className={styles.metaRow}>
                      <StatusPill tone="info">{row.eventType}</StatusPill>
                      <span className={styles.value}>{row.retailer}</span>
                      {row.priceNgn != null ? (
                        <span className={styles.value}>{money(row.priceNgn)}</span>
                      ) : null}
                      {row.priceRank ? (
                        <StatusPill tone="success">{row.priceRank}</StatusPill>
                      ) : null}
                      <span style={{ fontSize: 'var(--text-cell)', color: 'var(--muted)' }}>
                        position: <strong>{row.position}</strong>
                      </span>
                      <RelativeTime iso={row.createdAt} />
                      <IdChip value={row.id} label="sig" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {rows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
