import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingRetailerApplications } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { Empty, Heading, Table, shortDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function RetailerApplicationsQueue() {
  await requireConsoleOperator();
  const rows = await listPendingRetailerApplications(getPostgresClient());
  return (
    <>
      <Heading title="Retailer applications" lede="Submitted partnership applications. Approval feeds the existing verification lane (ADR 0003); it does not publish a retailer." />
      {rows.length === 0 ? <Empty label="retailer application" /> : (
        <Table head={<tr><th>Store</th><th>Email</th><th>Verified</th><th>Submitted</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.storeName}</td>
              <td className={styles.mono}>{row.email}</td>
              <td>{row.emailVerifiedAt
                ? <span className={`${styles.pill} ${styles.pillOk}`}>verified</span>
                : <span className={`${styles.pill} ${styles.pillDanger}`}>unverified</span>}</td>
              <td>{shortDate(row.submittedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
