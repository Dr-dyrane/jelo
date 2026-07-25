import type { Metadata } from 'next';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { getPostgresClient } from '@/lib/db/postgres';
import { pendingQueueCounts } from '@/lib/moderation/queues';
import { OpsChrome } from '@/components/ops/shell/OpsChrome';
import styles from './ops.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Ops · JeloCare' },
  robots: { index: false, follow: false },
};

// Console chrome layout with responsive sidebar/rail/mobile-bar shell (ADR 0007).
export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const operator = await requireConsoleOperator();
  const counts = await pendingQueueCounts(getPostgresClient());

  return (
    <div className={styles.body}>
      <OpsChrome operator={operator} counts={counts}>
        {children}
      </OpsChrome>
    </div>
  );
}
