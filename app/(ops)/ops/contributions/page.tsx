import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingContributions } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { Empty, Heading, Table, shortDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function ContributionsQueue() {
  await requireConsoleOperator();
  const rows = await listPendingContributions(getPostgresClient());
  return (
    <>
      <Heading title="Community contributions" lede="Anonymous submissions, preserved immutably. A decision marks them reviewed; it never writes a canonical record." />
      {rows.length === 0 ? <Empty label="contribution" /> : (
        <Table head={<tr><th>Kind</th><th>Payload</th><th>Submitted</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td><span className={`${styles.pill} ${styles.pillWarn}`}>{row.kind}</span></td>
              <td className={styles.mono}>{JSON.stringify(row.payload).slice(0, 140)}</td>
              <td>{shortDate(row.submittedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
