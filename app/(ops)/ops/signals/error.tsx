'use client';

import { ErrorState } from '@/components/ops/state/ErrorState';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';

export default function SignalsError({ reset }: { reset: () => void }) {
  return (
    <OpsWorkspace title="Signals">
      <ErrorState
        title="Couldn’t load signals"
        detail="Activity numbers are temporarily unavailable."
        onRetry={reset}
      />
    </OpsWorkspace>
  );
}
