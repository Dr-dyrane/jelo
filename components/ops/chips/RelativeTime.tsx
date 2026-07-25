import { relativeTime, shortDate } from '@/lib/format/time';
import styles from './chips.module.css';

// Recency for triage (relative) or an observed date (date). The machine-readable
// ISO stays in dateTime + title; the human sees "3h ago".
export function RelativeTime({ iso, mode = 'relative' }: { iso: string | null; mode?: 'relative' | 'date' }) {
  if (!iso) return <span className={styles.time}>—</span>;
  const label = mode === 'date' ? shortDate(iso) : relativeTime(iso);
  return <time className={styles.time} dateTime={iso} title={iso}>{label}</time>;
}
