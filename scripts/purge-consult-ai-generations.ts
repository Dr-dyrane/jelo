import postgres from "postgres";
import {
  assertConsultAiRetentionOperatorEnvironment,
  executeConsultAiRetentionOperator,
  parseConsultAiRetentionOptions,
  type ConsultAiRetentionAggregate,
} from "./lib/consult-ai-retention";
import { requireAdminDatabaseUrl } from "./lib/admin-database";

type CountRow = { count: number };
type BatchRow = { selected: number; deleted: number };

async function main() {
  const options = parseConsultAiRetentionOptions(process.argv.slice(2));
  assertConsultAiRetentionOperatorEnvironment(process.env);
  const connectionString = requireAdminDatabaseUrl();
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connection: {
      application_name: "jelocare-consult-ai-retention-operator",
    },
  });

  try {
    const result = await executeConsultAiRetentionOperator(options, {
      countEligible: () =>
        sql.begin("read only", async (transaction) => {
          const [row] = await transaction<CountRow[]>`
            select count(*)::integer as count
            from public.consult_ai_generations
            where retain_until <= now()
          `;
          return row?.count ?? 0;
        }),
      applyBatch: (limit) =>
        sql.begin(async (transaction): Promise<ConsultAiRetentionAggregate> => {
          const [eligibleRow] = await transaction<CountRow[]>`
            select count(*)::integer as count
            from public.consult_ai_generations
            where retain_until <= now()
          `;
          const [batchRow] = await transaction<BatchRow[]>`
            with selected as materialized (
              select id
              from public.consult_ai_generations
              where retain_until <= now()
              order by retain_until, id
              limit ${limit}
              for update skip locked
            ), deleted as (
              delete from public.consult_ai_generations as generation
              using selected
              where generation.id = selected.id
              returning 1
            )
            select
              (select count(*)::integer from selected) as selected,
              (select count(*)::integer from deleted) as deleted
          `;
          const [remainingRow] = await transaction<CountRow[]>`
            select count(*)::integer as count
            from public.consult_ai_generations
            where retain_until <= now()
          `;
          return {
            eligible: eligibleRow?.count ?? 0,
            selected: batchRow?.selected ?? 0,
            deleted: batchRow?.deleted ?? 0,
            remaining: remainingRow?.count ?? 0,
          };
        }),
    });
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error(
    "Ask Jelo retention operator failed; no generation data or connection details were printed.",
  );
  process.exitCode = 1;
});
