'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useContextFab } from '@/components/ops/shell/OpsShellContext';
import styles from './signals.module.css';

export function SignalsRefreshControl() {
  const router = useRouter();
  const setContextFab = useContextFab();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setContextFab({
      icon: isPending ? LoaderCircle : RefreshCw,
      label: isPending ? 'Refreshing signals' : 'Refresh signals',
      onClick: () => {
        if (isPending) return;
        startTransition(() => router.refresh());
      },
    });
    return () => setContextFab(null);
  }, [isPending, router, setContextFab]);

  return (
    <span
      className={styles.refreshFeedback}
      data-visible={isPending ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      {isPending ? (
        <>
          <LoaderCircle size={14} aria-hidden="true" />
          Refreshing
        </>
      ) : null}
    </span>
  );
}
