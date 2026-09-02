import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MARKET_FINDER_PRODUCTION_DATABASE_TARGET = {
  projectId: "spring-field-93817903",
  branchId: "br-dry-thunder-av63kxcd",
  branchName: "main",
  databaseName: "neondb",
} as const;

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Neon production ${label} response is not an object.`);
  }
  return value as JsonObject;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function databaseName(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("Production database attestation received an invalid URL.");
  }
}

function endpointHosts(endpoint: JsonObject) {
  const hosts =
    endpoint.hosts && typeof endpoint.hosts === "object"
      ? (endpoint.hosts as JsonObject)
      : {};
  return new Set(
    [
      stringValue(endpoint.host),
      stringValue(hosts.read_write_host),
      stringValue(hosts.read_write_pooled_host),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
}

function connectionHost(connectionString: string) {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error("Production database attestation received an invalid URL.");
  }
}

/**
 * Binds both protected operator and application-runtime credentials to the
 * repository-owned production Neon project, branch, database, and endpoint.
 */
export function assertNeonProductionControlPlane(
  connectionStrings: {
    admin: string;
    runtime: string;
  },
  branchResponse: unknown,
  endpointsResponse: unknown,
) {
  const target = MARKET_FINDER_PRODUCTION_DATABASE_TARGET;
  const branchEnvelope = objectValue(branchResponse, "branch");
  const branch = objectValue(branchEnvelope.branch ?? branchEnvelope, "branch");
  if (
    branch.id !== target.branchId ||
    branch.project_id !== target.projectId ||
    branch.name !== target.branchName ||
    branch.primary !== true ||
    branch.default !== true ||
    branch.current_state !== "ready"
  ) {
    throw new Error(
      "Neon branch identity does not match the repository-owned production target.",
    );
  }

  if (
    databaseName(connectionStrings.admin) !== target.databaseName ||
    databaseName(connectionStrings.runtime) !== target.databaseName
  ) {
    throw new Error(
      "Database credential does not target the repository-owned production database.",
    );
  }

  const endpointEnvelope = objectValue(endpointsResponse, "endpoints");
  if (!Array.isArray(endpointEnvelope.endpoints)) {
    throw new Error("Neon production response is missing its endpoint list.");
  }
  const endpoint = endpointEnvelope.endpoints
    .map((value) => objectValue(value, "endpoint"))
    .find(
      (value) =>
        value.project_id === target.projectId &&
        value.branch_id === target.branchId &&
        value.type === "read_write" &&
        value.disabled === false,
    );
  if (!endpoint) {
    throw new Error(
      "Neon production target has no enabled read-write endpoint.",
    );
  }

  const allowedHosts = endpointHosts(endpoint);
  if (
    !allowedHosts.has(connectionHost(connectionStrings.admin)) ||
    !allowedHosts.has(connectionHost(connectionStrings.runtime))
  ) {
    throw new Error(
      "Database credential host is not bound to the production Neon endpoint.",
    );
  }
}

async function neonJson(path: string) {
  const environment = { ...process.env };
  delete environment.MIGRATION_DATABASE_URL;
  delete environment.APP_DATABASE_URL;
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "neonctl",
      ["api", path, "--output", "json"],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: environment,
      },
    ));
  } catch {
    throw new Error(
      "Authenticated read-only Neon production attestation failed.",
    );
  }
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(
      "Neon production control-plane attestation returned invalid JSON.",
    );
  }
}

export async function attestMarketFinderProductionDatabase(connectionStrings: {
  admin: string;
  runtime: string;
}) {
  const target = MARKET_FINDER_PRODUCTION_DATABASE_TARGET;
  const project = encodeURIComponent(target.projectId);
  const branch = encodeURIComponent(target.branchId);
  const [branchResponse, endpointsResponse] = await Promise.all([
    neonJson(`/projects/${project}/branches/${branch}`),
    neonJson(`/projects/${project}/endpoints`),
  ]);
  assertNeonProductionControlPlane(
    connectionStrings,
    branchResponse,
    endpointsResponse,
  );
}
