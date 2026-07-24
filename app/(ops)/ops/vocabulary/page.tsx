import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingModerationValues } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { Empty, Heading, Table, shortDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function VocabularyQueue() {
  await requireConsoleOperator();
  const rows = await listPendingModerationValues(getPostgresClient());
  return (
    <>
      <Heading title="Custom vocabulary" lede="Values shoppers typed that no canonical entity matched, awaiting a mapping decision or rejection." />
      {rows.length === 0 ? <Empty label="vocabulary" /> : (
        <Table head={<tr><th>Kind</th><th>Raw</th><th>Normalized</th><th>Seen</th><th>Last seen</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.valueKind}</td>
              <td>{row.rawValue}</td>
              <td className={styles.mono}>{row.normalizedValue}</td>
              <td>{row.occurrenceCount}</td>
              <td>{shortDate(row.lastSeenAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
