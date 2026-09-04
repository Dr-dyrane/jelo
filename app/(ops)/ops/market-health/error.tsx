"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ops/state/ErrorState";
import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";

export default function MarketHealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Could not load market health.", error);
  }, [error]);

  return (
    <OpsWorkspace title="Market health">
      <ErrorState title="Couldn’t load market health" onRetry={reset} />
    </OpsWorkspace>
  );
}
