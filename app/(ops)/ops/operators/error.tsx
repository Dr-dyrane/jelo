'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function OperatorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load team access.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Operators">
      <ErrorState title="Couldn’t load team access" onRetry={reset} />
    </OpsWorkspace>
  );
}
