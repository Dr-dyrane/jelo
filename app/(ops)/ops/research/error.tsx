'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ops/state/ErrorState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';

export default function ResearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load research work.', error);
  }, [error]);

  return (
    <>
      <OpsWorkspace title="Research">
        <ErrorState title="Research is unavailable." detail="Nothing changed. Try again." onRetry={reset} />
      </OpsWorkspace>
      <span hidden data-ops-reserve-detail />
    </>
  );
}
