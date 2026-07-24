import { getPostgresClient } from '@/lib/db/postgres';
import { listCommerceSignals } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { Empty, Heading, Table, shortDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function SignalsView() {
  await requireConsoleOperator();
  const rows = await listCommerceSignals(getPostgresClient());
  return (
    <>
      <Heading title="Commerce signals" lede="store_click measurement, read-only. Never joined to health-shaped behaviour and never an input to store ranking (ADR 0006)." />
      {rows.length === 0 ? <Empty label="signal" /> : (
        <Table head={<tr><th>Event</th><th>Product</th><th>Retailer</th><th>Rank</th><th>Price</th><th>When</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.eventType}</td>
              <td className={styles.mono}>{row.productSlug}</td>
              <td>{row.retailer}</td>
              <td>{row.priceRank}</td>
              <td>{row.priceNgn != null ? `₦${row.priceNgn.toLocaleString('en-NG')}` : '—'}</td>
              <td>{shortDate(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
