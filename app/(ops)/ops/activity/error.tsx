'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ops/state/ErrorState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load insights.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Insights">
      <ErrorState
        title="Couldn’t load insights"
        detail="Try again in a moment."
        onRetry={reset}
      />
    </OpsWorkspace>
  );
}
