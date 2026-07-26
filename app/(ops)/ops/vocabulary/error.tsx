'use client';

import { useEffect } from 'react';
import { OpsWorkspace } from '@/components/ops/workspace/OpsWorkspace';
import { ErrorState } from '@/components/ops/state/ErrorState';

export default function VocabularyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Could not load vocabulary.', error);
  }, [error]);

  return (
    <OpsWorkspace title="Vocabulary">
      <ErrorState title="Couldn’t load vocabulary" onRetry={reset} />
    </OpsWorkspace>
  );
}
