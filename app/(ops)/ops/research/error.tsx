'use client';

import { ErrorState } from '@/components/ops/state/ErrorState';

export default function ResearchError({ reset }: { reset: () => void }) {
  return <ErrorState title="Research is unavailable." detail="Try loading it again." onRetry={reset} />;
}
