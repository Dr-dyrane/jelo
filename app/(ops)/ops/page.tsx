import Link from 'next/link';
import { getPostgresClient } from '@/lib/db/postgres';
import { pendingQueueCounts } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../ops.module.css';

export const dynamic = 'force-dynamic';

const TILES = [
  { href: '/ops/contributions', label: 'Contributions', key: 'contributions', hint: 'Community submissions' },
  { href: '/ops/edges', label: 'Knowledge edges', key: 'edges', hint: 'Derived triples' },
  { href: '/ops/observations', label: 'Observations', key: 'observations', hint: 'Price & outcome' },
  { href: '/ops/vocabulary', label: 'Vocabulary', key: 'values', hint: 'Custom values' },
  { href: '/ops/retailers', label: 'Retailer applications', key: 'retailers', hint: 'Partnership intake' },
  { href: '/ops/signals', label: 'Commerce signals', key: 'signals', hint: 'store_click · read-only' },
] as const;

export default async function OpsOverview() {
  await requireConsoleOperator();
  const counts = await pendingQueueCounts(getPostgresClient());
  return (
    <>
      <h1 className={styles.h1}>Moderation queues</h1>
      <p className={styles.lede}>Pending items awaiting review. Nothing here publishes to the catalogue; every decision is recorded in the audit log.</p>
      <div className={styles.overview}>
        {TILES.map(tile => {
          const count = counts[tile.key];
          return (
            <Link key={tile.href} href={tile.href} className={styles.tile}>
              <span className={`${styles.tileCount} ${count === 0 ? styles.zero : ''}`}>{count}</span>
              <span className={styles.tileLabel}>{tile.label}</span>
              <span className={styles.tileHint}>{tile.hint}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
