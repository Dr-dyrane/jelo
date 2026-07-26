'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function EdgesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load relationships.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Relationships">
      <ErrorState title="Couldn’t load relationships" onRetry={reset} />
    </OpsWorkspace>
  );
}
