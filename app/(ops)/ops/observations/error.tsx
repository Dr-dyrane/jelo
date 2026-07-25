'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ops/state/ErrorState';
import opsStyles from '../../ops.module.css';

export default function ObservationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Recorded for observability; the operator sees a calm message, never a stack.
    console.error(error);
  }, [error]);

  return (
    <>
      <h1 className={opsStyles.h1}>Community observations</h1>
      <ErrorState
        title="Couldn’t load the observations queue"
        detail="Something interrupted the read. Try again — it usually clears."
        onRetry={reset}
      />
    </>
  );
}
