import { execFileSync, spawnSync } from "node:child_process";
import {
  StaticSyncProposalValidationError,
  validateStaticSyncProposal,
} from "@/lib/inventory/static-sync-proposal";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a Git revision`);
  }
  return value;
}

function git(args: string[]) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  const base = argument("--base", "origin/main");
  const head = argument("--head", "HEAD");
  const ancestor = spawnSync("git", [
    "merge-base",
    "--is-ancestor",
    base,
    head,
  ]);
  if (ancestor.status !== 0) {
    throw new Error(`${head} must descend from ${base}`);
  }

  const changedPaths = git(["diff", "--name-only", base, head])
    .trim()
    .split("\n")
    .filter(Boolean);
  if (
    changedPaths.length !== 1 ||
    changedPaths[0] !== "data/retail-offers.ts"
  ) {
    throw new Error(
      `Inventory sync proposal must change only data/retail-offers.ts; found: ${changedPaths.join(", ") || "none"}`,
    );
  }

  const result = validateStaticSyncProposal({
    baseContent: git(["show", `${base}:data/retail-offers.ts`]),
    candidateContent: git(["show", `${head}:data/retail-offers.ts`]),
  });
  process.stdout.write(
    `Validated ${result.changedOffers} static offer change(s): ${result.refreshedOffers} refreshed, ${result.invalidatedOffers} invalidated.\n`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const prefix =
    error instanceof StaticSyncProposalValidationError
      ? "Unsafe inventory sync proposal"
      : "Inventory sync proposal validation failed";
  process.stderr.write(`${prefix}: ${message}\n`);
  process.exitCode = 1;
}
