'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function ObservationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Could not load observations.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Observations">
      <ErrorState title="Couldn’t load observations" onRetry={reset} />
    </OpsWorkspace>
  );
}
