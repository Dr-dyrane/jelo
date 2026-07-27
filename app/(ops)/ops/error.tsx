'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ops/state/ErrorState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';

export default function OverviewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Could not load the operations overview.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Overview">
      <ErrorState
        title="Couldn’t load the overview"
        detail="Nothing changed. Try again."
        onRetry={reset}
      />
    </OpsWorkspace>
  );
}
