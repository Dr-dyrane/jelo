import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingEdges } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import styles from '../../ops.module.css';
import { DecideForm, Empty, Heading, Table, shortDate } from '../ui';
import { decideEdgeAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EdgesQueue() {
  await requireConsoleOperator();
  const rows = await listPendingEdges(getPostgresClient());
  return (
    <>
      <Heading title="Knowledge edges" lede="Typed triples derived from contributions, pending review. Community-reported until an operator approves." />
      {rows.length === 0 ? <Empty label="edge" /> : (
        <Table head={<tr><th>Subject</th><th>Predicate</th><th>Object</th><th>Received</th><th>Decision</th></tr>}>
          {rows.map(row => (
            <tr key={row.id}>
              <td className={styles.mono}>{row.subjectKind}:{row.subjectRef}</td>
              <td>{row.predicate}</td>
              <td className={styles.mono}>{row.objectKind}:{row.objectRef}</td>
              <td>{shortDate(row.createdAt)}</td>
              <td><DecideForm action={decideEdgeAction} id={row.id} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
