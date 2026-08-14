import { spawn } from "node:child_process";

type ReleaseGate = {
  label: string;
  script: string;
};

const releaseGates: ReleaseGate[] = [
  { label: "Lint", script: "lint" },
  { label: "Typecheck", script: "typecheck" },
  { label: "Node tests", script: "test" },
  { label: "Documentation", script: "docs:check" },
  { label: "Migration inventory", script: "db:migrations:validate" },
  {
    label: "Per-SKU catalogue intake projection",
    script: "catalogue:intake:verify",
  },
  {
    label: "Public catalogue search projection",
    script: "catalogue:search:verify",
  },
  {
    label: "Private publication dossiers",
    script: "catalogue:publication:verify",
  },
  {
    label: "Explicit catalogue releases",
    script: "catalogue:publication:releases:verify",
  },
  {
    label: "Private catalogue research priorities",
    script: "catalogue:research:verify",
  },
  {
    label: "Private publication image bytes",
    script: "catalogue:publication:images:verify",
  },
  { label: "Canonical media", script: "assets:verify" },
];

const releaseGateGroups = [
  ["lint", "typecheck", "test", "docs:check", "db:migrations:validate"],
  [
    "catalogue:intake:verify",
    "catalogue:search:verify",
    "catalogue:publication:verify",
    "catalogue:publication:releases:verify",
    "catalogue:research:verify",
    "catalogue:publication:images:verify",
    "assets:verify",
  ],
] as const;

function runNpmScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...(script === "test"
          ? {
              NODE_ENV: "test",
              KV_REST_API_URL: "",
              KV_REST_API_TOKEN: "",
            }
          : {}),
      },
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`npm run ${script} exited with code ${code ?? "unknown"}`),
        );
    });
  });
}

async function main() {
  const gateByScript = new Map(releaseGates.map((gate) => [gate.script, gate]));
  for (const scripts of releaseGateGroups) {
    const gates = scripts.map((script) => gateByScript.get(script)!);
    await Promise.all(
      gates.map((gate) => {
        console.log(`\nRelease gate: ${gate.label}`);
        return runNpmScript(gate.script);
      }),
    );
  }
  console.log("\nRelease verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
