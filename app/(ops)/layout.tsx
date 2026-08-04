import type { Metadata, Viewport } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { getPostgresClient } from '@/lib/db/postgres';
import { pendingQueueCounts } from '@/lib/moderation/queues';
import { getOpsSidebarSummary } from '@/lib/moderation/sidebar-summary';
import { OpsChrome } from '@/components/ops/shell/OpsChrome';

export const metadata: Metadata = {
  title: { absolute: 'Ops · JeloCare' },
  description: 'Private JeloCare operations workspace.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

// Console chrome layout with responsive sidebar/rail/mobile-bar shell (ADR 0007).
export default async function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  noStore();
  const operator = await requireConsoleOperator();
  const sql = getPostgresClient();
  const [counts, sidebarSummary] = await Promise.all([
    pendingQueueCounts(sql),
    getOpsSidebarSummary(sql, operator),
  ]);

  return (
    <OpsChrome operator={operator} counts={counts} sidebarSummary={sidebarSummary}>
      {children}
    </OpsChrome>
  );
}
