import postgres, { type Sql } from 'postgres';
import { z } from 'zod';
import { parseCommunityRetailerResearchResolutionCommand } from '@/lib/community-intake/retailer-research-resolution-command';
import {
  preflightCommunityRetailerResearchTask,
  resolveCommunityRetailerResearchTask,
} from '@/lib/community-intake/retailer-research-resolution';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type Operator = {
  auth_subject: string;
  role: 'moderator' | 'operator' | 'admin';
};

function connectionString() {
  return requireAdminDatabaseUrl();
}

async function activeOperator(sql: Sql) {
  const email = z.email().parse(process.env.MODERATION_OPERATOR_EMAIL);
  const rows = await sql<Operator[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${email}) and active = true
    limit 2
  `;
  if (rows.length !== 1 || rows[0].role === 'moderator') {
    throw new Error('MODERATION_OPERATOR_EMAIL must identify exactly one active operator or admin.');
  }
  return rows[0];
}

async function main() {
  const command = parseCommunityRetailerResearchResolutionCommand(process.argv.slice(2));
  const sql = postgres(connectionString(), { max: 1, prepare: false });
  try {
    const operator = await activeOperator(sql);
    const resolution = { ...command.resolution, reviewedBy: operator.auth_subject };
    const row = await preflightCommunityRetailerResearchTask(sql, resolution);
    const [task] = await sql<{
      id: string;
      task_kind: string;
      entity_ref: string;
      status: string;
    }[]>`
      select task.id, task.task_kind, task.entity_ref, task.status
      from community_research_tasks task
      where task.id = ${row.taskId} and task.entity_kind = 'retailer'
    `;
    if (!task) throw new Error('Community retailer research task does not exist.');

    const result = command.apply
      ? await resolveCommunityRetailerResearchTask(sql, resolution)
      : row;
    console.log(JSON.stringify({
      mode: command.apply ? 'applied' : 'dry-run',
      task: {
        id: task.id,
        kind: task.task_kind,
        reference: task.entity_ref,
        previousStatus: task.status,
      },
      resolution: result,
      writesCanonicalRetailer: false,
      writesOffers: false,
    }, null, command.json ? 0 : 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Retailer research resolution failed.');
  process.exitCode = 1;
});
