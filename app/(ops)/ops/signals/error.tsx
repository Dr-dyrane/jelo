'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ops/state/ErrorState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';

export default function SignalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load signals.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Signals">
      <ErrorState
        title="Couldn’t load signals"
        onRetry={reset}
      />
    </OpsWorkspace>
  );
}
