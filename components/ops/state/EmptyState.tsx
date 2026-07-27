import Link from 'next/link';
import styles from './state.module.css';

// Guided first-run, not a shrug: a calm title and one reassuring line.
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: {
    href: string;
    label: string;
  };
}) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyBody}>{body}</p>
      {action ? (
        <Link className={styles.emptyAction} href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
