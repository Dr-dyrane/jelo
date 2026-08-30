import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  StaticSyncProposalValidationError,
  mergeStaticSyncProposal,
} from "@/lib/inventory/static-sync-proposal";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function git(args: string[]) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function requireAncestor(base: string, revision: string) {
  const result = spawnSync("git", [
    "merge-base",
    "--is-ancestor",
    base,
    revision,
  ]);
  if (result.status !== 0) {
    throw new Error(`${revision} must descend from history base ${base}`);
  }
}

function main() {
  const base = argument("--base");
  const current = argument("--current");
  const proposal = argument("--proposal");
  const writeIndex = process.argv.indexOf("--write");
  const outputPath =
    writeIndex === -1 ? undefined : process.argv[writeIndex + 1];
  if (writeIndex !== -1 && outputPath !== "data/retail-offers.ts") {
    throw new Error("--write may target only data/retail-offers.ts");
  }
  requireAncestor(base, current);
  requireAncestor(base, proposal);

  const changedPaths = git(["diff", "--name-only", base, proposal])
    .trim()
    .split("\n")
    .filter(Boolean);
  if (
    changedPaths.length !== 1 ||
    changedPaths[0] !== "data/retail-offers.ts"
  ) {
    throw new Error(
      `Inventory proposal history must change only data/retail-offers.ts; found: ${changedPaths.join(", ") || "none"}`,
    );
  }

  const result = mergeStaticSyncProposal({
    baseContent: git(["show", `${base}:data/retail-offers.ts`]),
    currentContent: git(["show", `${current}:data/retail-offers.ts`]),
    proposalContent: git(["show", `${proposal}:data/retail-offers.ts`]),
  });
  if (outputPath) writeFileSync(outputPath, result.content, "utf8");
  process.stdout.write(
    `Resolved ${result.proposalChanges} historical proposal change(s): ${result.applied} applied, ${result.alreadyApplied} already present, ${result.staleSkipped} superseded by newer evidence, ${result.removedSkipped} superseded by removal.\n`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const prefix =
    error instanceof StaticSyncProposalValidationError
      ? "Unsafe historical inventory conflict"
      : "Inventory history merge failed";
  process.stderr.write(`${prefix}: ${message}\n`);
  process.exitCode = 1;
}
