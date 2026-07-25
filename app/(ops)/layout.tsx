import type { Metadata } from 'next';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { getPostgresClient } from '@/lib/db/postgres';
import { pendingQueueCounts } from '@/lib/moderation/queues';
import { getOpsSidebarSummary } from '@/lib/moderation/sidebar-summary';
import { OpsChrome } from '@/components/ops/shell/OpsChrome';
import styles from './ops.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Ops · JeloCare' },
  robots: { index: false, follow: false },
};

// Console chrome layout with responsive sidebar/rail/mobile-bar shell (ADR 0007).
export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const operator = await requireConsoleOperator();
  const sql = getPostgresClient();
  const [counts, sidebarSummary] = await Promise.all([
    pendingQueueCounts(sql),
    getOpsSidebarSummary(sql, operator),
  ]);

  return (
    <div className={styles.body}>
      <OpsChrome operator={operator} counts={counts} sidebarSummary={sidebarSummary}>
        {children}
      </OpsChrome>
    </div>
  );
}
