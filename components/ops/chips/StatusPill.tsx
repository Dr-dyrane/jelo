import type { ReactNode } from 'react';
import styles from './chips.module.css';

export type PillTone = 'success' | 'warning' | 'danger' | 'info';

// Formalizes the ops .pillOk/.pillWarn/.pillDanger family onto the --state-* scale.
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>;
}
