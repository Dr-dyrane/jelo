import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RehearsalTarget } from "./rehearsal-target";

const execFileAsync = promisify(execFile);

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Neon ${label} response is not an object.`);
  }
  return value as JsonObject;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function assertNeonRehearsalControlPlane(
  target: Required<
    Pick<RehearsalTarget, "projectId" | "branchId" | "branchName">
  >,
  connectionString: string,
  branchResponse: unknown,
  parentResponse: unknown,
  endpointsResponse: unknown,
) {
  const branchEnvelope = objectValue(branchResponse, "branch");
  const branch = objectValue(branchEnvelope.branch ?? branchEnvelope, "branch");
  if (
    branch.id !== target.branchId ||
    branch.name !== target.branchName ||
    branch.project_id !== target.projectId
  ) {
    throw new Error(
      "Neon branch identity does not match the confirmed rehearsal target.",
    );
  }
  const parentId = stringValue(branch.parent_id);
  if (!parentId) {
    throw new Error(
      "Rehearsal target must be a child branch, never the root production branch.",
    );
  }
  if (
    branch.protected !== false ||
    branch.default !== false ||
    branch.primary === true
  ) {
    throw new Error(
      "Rehearsal target must be explicitly non-protected and non-primary.",
    );
  }

  const parentEnvelope = objectValue(parentResponse, "parent branch");
  const parent = objectValue(
    parentEnvelope.branch ?? parentEnvelope,
    "parent branch",
  );
  if (
    parent.id !== parentId ||
    parent.project_id !== target.projectId ||
    parent.default !== true
  ) {
    throw new Error(
      "Rehearsal target must be derived directly from the project's default production branch.",
    );
  }

  const endpointEnvelope = objectValue(endpointsResponse, "endpoints");
  if (!Array.isArray(endpointEnvelope.endpoints)) {
    throw new Error("Neon endpoints response is missing its endpoint list.");
  }
  const expectedHost = new URL(connectionString).hostname.toLowerCase();
  const endpoint = endpointEnvelope.endpoints
    .map((value) => objectValue(value, "endpoint"))
    .find(
      (value) =>
        value.project_id === target.projectId &&
        value.branch_id === target.branchId &&
        stringValue(value.host)?.toLowerCase() === expectedHost,
    );
  if (
    !endpoint ||
    endpoint.type !== "read_write" ||
    endpoint.disabled !== false
  ) {
    throw new Error(
      "Rehearsal database URL is not the enabled read-write endpoint for the confirmed branch.",
    );
  }
}

async function neonJson(path: string) {
  let stdout: string;
  const environment = { ...process.env };
  delete environment.MIGRATION_DATABASE_URL;
  delete environment.MIGRATION_REHEARSAL_DATABASE_URL;
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
      "Authenticated read-only Neon control-plane attestation failed.",
    );
  }
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error("Neon control-plane attestation returned invalid JSON.");
  }
}

export async function attestNeonRehearsalTarget(
  target: Required<
    Pick<RehearsalTarget, "projectId" | "branchId" | "branchName">
  >,
  connectionString: string,
) {
  const project = encodeURIComponent(target.projectId);
  const branch = encodeURIComponent(target.branchId);
  const branchResponse = await neonJson(
    `/projects/${project}/branches/${branch}`,
  );
  const branchEnvelope = objectValue(branchResponse, "branch");
  const branchRecord = objectValue(
    branchEnvelope.branch ?? branchEnvelope,
    "branch",
  );
  const parentId = stringValue(branchRecord.parent_id);
  if (!parentId) {
    throw new Error(
      "Rehearsal target must be a child of the default production branch.",
    );
  }
  const [parentResponse, endpointsResponse] = await Promise.all([
    neonJson(`/projects/${project}/branches/${encodeURIComponent(parentId)}`),
    neonJson(`/projects/${project}/endpoints`),
  ]);
  assertNeonRehearsalControlPlane(
    target,
    connectionString,
    branchResponse,
    parentResponse,
    endpointsResponse,
  );
}
