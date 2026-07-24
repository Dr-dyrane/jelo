import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingObservations } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { DecideForm, Empty, Heading, Table, shortDate } from '../ui';
import { decideObservationAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ObservationsQueue() {
  await requireConsoleOperator();
  const rows = await listPendingObservations(getPostgresClient());
  return (
    <>
      <Heading title="Community observations" lede="Reported prices and outcomes awaiting review. A decision is moderation input only; nothing here writes to the catalogue." />
      {rows.length === 0 ? <Empty label="observation" /> : (
        <Table head={<tr><th>Kind</th><th>Subject</th><th>Value</th><th>Observed</th><th>Received</th><th>Decision</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td><span className={`${styles.pill} ${row.kind === 'price' ? styles.pillOk : styles.pillWarn}`}>{row.kind}</span></td>
              <td className={styles.mono}>{row.subjectRef}</td>
              <td>{row.kind === 'price'
                ? <span className={styles.amount}>{row.amountNgn != null ? `₦${row.amountNgn.toLocaleString('en-NG')}` : '—'}</span>
                : (row.outcome ?? '—')}</td>
              <td>{shortDate(row.observedOn)}</td>
              <td>{shortDate(row.createdAt)}</td>
              <td><DecideForm action={decideObservationAction} id={row.id} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
