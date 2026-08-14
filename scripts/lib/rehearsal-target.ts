export const REHEARSAL_TARGET_CONFIRMATION = "non-production-disposable-branch";

export type RehearsalTarget = {
  projectId?: string;
  branchId?: string;
  branchName?: string;
  confirmation?: string;
};

export function assertRehearsalTarget(target: RehearsalTarget) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(target.projectId ?? "")) {
    throw new Error("Rehearsal requires the verified Neon --project-id value.");
  }
  if (!/^br-[a-z0-9-]+$/.test(target.branchId ?? "")) {
    throw new Error(
      "Rehearsal requires the verified Neon --branch-id=br-... value.",
    );
  }
  if (
    !/^rehearsal\/[a-z0-9][a-z0-9._/-]{2,119}$/.test(target.branchName ?? "")
  ) {
    throw new Error(
      "Rehearsal branch name must use the rehearsal/... namespace.",
    );
  }
  if (target.confirmation !== REHEARSAL_TARGET_CONFIRMATION) {
    throw new Error(
      `Rehearsal requires --confirm-target=${REHEARSAL_TARGET_CONFIRMATION}.`,
    );
  }
  return {
    projectId: target.projectId!,
    branchId: target.branchId!,
    branchName: target.branchName!,
  };
}
