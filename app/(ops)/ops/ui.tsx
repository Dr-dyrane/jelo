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
