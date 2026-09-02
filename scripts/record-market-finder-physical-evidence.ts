import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { z, ZodError } from "zod";
import {
  createPhysicalProductObservation,
  decidePhysicalProductObservation,
  preflightPhysicalProductObservation,
  preflightPhysicalProductObservationDecision,
} from "@/lib/moderation/database-transitions";
import {
  physicalProductEvidenceInputSchema,
  physicalProductObservationDecisionInputSchema,
  type PhysicalProductEvidenceInput,
} from "@/lib/moderation/schema";
import { requireAdminDatabaseUrl } from "./lib/admin-database";

type RecordCommand = {
  operation: "record";
  apply: boolean;
  evidence: PhysicalProductEvidenceInput;
};

type DecideCommand = {
  operation: "decide";
  apply: boolean;
  observationId: string;
  decision: "approve" | "reject";
  rationale: string;
};

export type PhysicalEvidenceCommand = RecordCommand | DecideCommand;

const recordOptions = new Set([
  "contribution-id",
  "availability",
  "observed-at",
  "expires-at",
  "source-method",
  "source-reference",
  "observed-title",
  "observed-size",
  "price-ngn",
  "rationale",
]);
const requiredRecordOptions = [...recordOptions].filter(
  (option) => option !== "price-ngn",
);
const decideOptions = new Set(["observation-id", "decision", "rationale"]);

function parseOptions(args: string[], allowed: Set<string>) {
  const values = new Map<string, string>();
  let apply = false;
  for (const argument of args) {
    if (argument === "--apply") {
      if (apply) throw new Error("--apply may be provided only once.");
      apply = true;
      continue;
    }
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 3) {
      throw new Error("Every command field must use --name=value syntax.");
    }
    const name = argument.slice(2, separator);
    if (!allowed.has(name)) throw new Error(`Unknown option --${name}.`);
    if (values.has(name)) {
      throw new Error(`Option --${name} may be provided only once.`);
    }
    values.set(name, argument.slice(separator + 1));
  }
  return { apply, values };
}

function required(values: Map<string, string>, option: string) {
  const value = values.get(option);
  if (value === undefined)
    throw new Error(`Missing required option --${option}.`);
  return value;
}

function optionalPriceNgn(values: Map<string, string>) {
  const value = values.get("price-ngn");
  if (value === undefined) return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(
      "--price-ngn must be a positive NGN amount with at most two decimals.",
    );
  }
  return Number(value);
}

export function parsePhysicalEvidenceCommand(
  args: string[],
): PhysicalEvidenceCommand {
  const [operation, ...options] = args;
  if (operation === "record") {
    const parsed = parseOptions(options, recordOptions);
    for (const option of requiredRecordOptions) required(parsed.values, option);
    return {
      operation,
      apply: parsed.apply,
      evidence: physicalProductEvidenceInputSchema.parse({
        contributionId: required(parsed.values, "contribution-id"),
        availability: required(parsed.values, "availability"),
        observedAt: required(parsed.values, "observed-at"),
        expiresAt: required(parsed.values, "expires-at"),
        sourceMethod: required(parsed.values, "source-method"),
        sourceReference: required(parsed.values, "source-reference"),
        observedTitle: required(parsed.values, "observed-title"),
        observedSize: required(parsed.values, "observed-size"),
        priceNgn: optionalPriceNgn(parsed.values),
        rationale: required(parsed.values, "rationale"),
      }),
    };
  }
  if (operation === "decide") {
    const parsed = parseOptions(options, decideOptions);
    const decision = physicalProductObservationDecisionInputSchema.parse({
      observationId: required(parsed.values, "observation-id"),
      decision: required(parsed.values, "decision"),
      rationale: required(parsed.values, "rationale"),
    });
    return {
      operation,
      apply: parsed.apply,
      observationId: decision.observationId,
      decision: decision.decision,
      rationale: decision.rationale,
    };
  }
  throw new Error("Choose the record or decide subcommand.");
}

export async function resolvePhysicalEvidenceAdmin(
  sql: Sql,
  operatorEmail: string | undefined = process.env.MODERATION_OPERATOR_EMAIL,
) {
  const email = z.email().parse(operatorEmail);
  const rows = await sql<{ auth_subject: string; role: string }[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${email})
      and active = true
    limit 2
  `;
  if (rows.length !== 1 || rows[0].role !== "admin") {
    throw new Error(
      "MODERATION_OPERATOR_EMAIL must identify exactly one active admin.",
    );
  }
  return rows[0].auth_subject;
}

export async function runPhysicalEvidenceCommand(
  sql: Sql,
  operatorSubject: string,
  command: PhysicalEvidenceCommand,
) {
  if (command.operation === "record") {
    if (!command.apply) {
      await preflightPhysicalProductObservation(
        sql,
        operatorSubject,
        command.evidence,
      );
      return {
        output: JSON.stringify({
          mode: "dry-run",
          operation: "record",
          ready: true,
          writes: false,
        }),
      };
    }
    const observationId = await createPhysicalProductObservation(
      sql,
      operatorSubject,
      command.evidence,
    );
    return { output: observationId };
  }

  if (!command.apply) {
    const result = await preflightPhysicalProductObservationDecision(
      sql,
      operatorSubject,
      command.observationId,
      command.decision,
      command.rationale,
    );
    return {
      output: JSON.stringify({
        mode: "dry-run",
        operation: "decide",
        ready: true,
        writes: false,
        nextStatus: result.nextStatus,
      }),
    };
  }

  const result = await decidePhysicalProductObservation(
    sql,
    operatorSubject,
    command.observationId,
    command.decision,
    command.rationale,
  );
  return {
    output: JSON.stringify({
      observationId: result.observationId,
      nextStatus: result.nextStatus,
      cacheScope: {
        marketSlug: result.marketSlug,
        retailerLocationId: result.retailerLocationId,
        productIdentityVersionId: result.productIdentityVersionId,
      },
    }),
  };
}

async function main() {
  const command = parsePhysicalEvidenceCommand(process.argv.slice(2));
  const sql = postgres(requireAdminDatabaseUrl(), { max: 1, prepare: false });
  try {
    const operatorSubject = await resolvePhysicalEvidenceAdmin(sql);
    const result = await runPhysicalEvidenceCommand(
      sql,
      operatorSubject,
      command,
    );
    console.log(result.output);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function safeErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Physical evidence command validation failed.";
  }
  return error instanceof Error
    ? error.message
    : "Physical evidence command failed.";
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
