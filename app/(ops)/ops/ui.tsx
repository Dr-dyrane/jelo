import type { ReactNode } from 'react';
import styles from '../ops.module.css';

export function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : '—';
}

export function Heading({ title, lede }: { title: string; lede?: string }) {
  return (
    <>
      <h1 className={styles.h1}>{title}</h1>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
    </>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className={styles.empty}>Nothing in the {label} queue right now.</div>;
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// A per-row decision form bound to a server action. The action re-runs the guard
// and reads the operator's own subject; the row id and optional note are the only
// client inputs. Two submit buttons carry the decision value.
export function DecideForm({
  action,
  id,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  return (
    <form action={action} className={styles.actions}>
      <input type="hidden" name="targetId" value={id} />
      <input name="rationale" placeholder="Note" aria-label="Decision note" className={styles.noteInput} />
      <button type="submit" name="decision" value="approve" className={`${styles.btn} ${styles.btnOk}`}>{approveLabel}</button>
      <button type="submit" name="decision" value="reject" className={`${styles.btn} ${styles.btnDanger}`}>{rejectLabel}</button>
    </form>
  );
}
