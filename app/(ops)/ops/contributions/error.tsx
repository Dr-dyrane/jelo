'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function ContributionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load contributions.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Contributions">
      <ErrorState title="Couldn’t load contributions" onRetry={reset} />
    </OpsWorkspace>
  );
}
