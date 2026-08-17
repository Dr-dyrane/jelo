"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ops/state/ErrorState";
import { OpsWorkspace } from "@/components/ops/workspace/OpsWorkspace";

export default function CareEvidenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Could not load care evidence.", error);
  }, [error]);

  return (
    <OpsWorkspace title="Care evidence">
      <ErrorState title="Couldn't load care evidence" onRetry={reset} />
    </OpsWorkspace>
  );
}
