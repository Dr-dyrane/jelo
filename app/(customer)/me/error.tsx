'use client';

import { MeRouteState } from '@/components/me/shell/me-route-state';

export default function MeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <MeRouteState state="error" onRetry={reset} />;
}
