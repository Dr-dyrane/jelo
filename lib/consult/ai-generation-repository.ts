import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type postgres from "postgres";
import { getPostgresClient } from "@/lib/db/postgres";

export type ConsultAiOutcome =
  "ordinary_care" | "clarification" | "condition_guide";

export type ConsultAiGenerationRecord = {
  id: string;
  reference: string;
};

export function consultInputDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function generationReference() {
  return `JAI-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function createConsultAiGeneration(input: {
  modelId: string;
  schemaVersion: number;
  inputSha256: string;
  inputCharacterCount: number;
  deterministicOutcome: ConsultAiOutcome;
}): Promise<ConsultAiGenerationRecord> {
  const sql = getPostgresClient();
  const [record] = await sql<{ id: string; public_reference: string }[]>`
    insert into consult_ai_generations (
      public_reference, lane, schema_version, model_id, input_sha256,
      input_character_count, deterministic_outcome
    ) values (
      ${generationReference()}, 'intake_shadow', ${input.schemaVersion}, ${input.modelId}, ${input.inputSha256},
      ${input.inputCharacterCount}, ${input.deterministicOutcome}
    )
    returning id, public_reference
  `;

  if (!record) throw new Error("consult_ai_generation_not_created");
  return { id: record.id, reference: record.public_reference };
}

export async function completeConsultAiGeneration(input: {
  id: string;
  output: postgres.JSONValue;
  usage: postgres.JSONValue;
  gatewayGenerationId: string | null;
  providerName: string | null;
  finishReason: string;
  costUsd: number | null;
  latencyMs: number;
}) {
  const sql = getPostgresClient();
  const [settled] = await sql<{ id: string }[]>`
    update consult_ai_generations
    set status = 'completed',
        output = ${sql.json(input.output)},
        usage = ${sql.json(input.usage)},
        gateway_generation_id = ${input.gatewayGenerationId},
        provider_name = ${input.providerName},
        finish_reason = ${input.finishReason},
        cost_usd = ${input.costUsd},
        cost_source = ${input.costUsd === null ? "unavailable" : "gateway_exact"},
        latency_ms = ${input.latencyMs},
        completed_at = now()
    where id = ${input.id} and status = 'pending'
    returning id
  `;
  if (!settled) throw new Error("consult_ai_generation_not_completed");
}

export async function failConsultAiGeneration(input: {
  id: string;
  errorCode: string;
  latencyMs: number;
}) {
  const sql = getPostgresClient();
  await sql`
    update consult_ai_generations
    set status = 'failed',
        error_code = ${input.errorCode},
        cost_source = 'unavailable',
        latency_ms = ${input.latencyMs},
        completed_at = now()
    where id = ${input.id} and status = 'pending'
  `;
}
