'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function RetailerApplicationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load retailer applications.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Retailer applications">
      <ErrorState
        title="Couldn’t load retailer applications"
        detail="Nothing changed. Try again."
        onRetry={reset}
      />
    </OpsWorkspace>
  );
}
