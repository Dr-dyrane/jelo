import postgres, { type Sql } from 'postgres';
import { z } from 'zod';
import { parseCommunityResearchResolutionCommand } from '@/lib/community-intake/research-resolution-command';
import {
  preflightCommunityProductResearchTask,
  resolveCommunityProductResearchTask,
} from '@/lib/community-intake/research-resolution';

type Operator = {
  auth_subject: string;
  role: 'moderator' | 'operator' | 'admin';
};

function connectionString() {
  const value = process.env.DATABASE_URL_UNPOOLED
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL;
  if (!/^postgres(?:ql)?:\/\//.test(value ?? '')) {
    throw new Error('A private Neon connection string is required.');
  }
  return value!;
}

async function activeOperator(sql: Sql) {
  const email = z.email().parse(process.env.MODERATION_OPERATOR_EMAIL);
  const rows = await sql<Operator[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${email}) and active = true
    limit 2
  `;
  if (rows.length !== 1) {
    throw new Error('MODERATION_OPERATOR_EMAIL must identify exactly one active operator.');
  }
  if (rows[0].role === 'moderator') {
    throw new Error('A research resolution requires an operator or admin.');
  }
  return rows[0];
}

async function main() {
  const command = parseCommunityResearchResolutionCommand(process.argv.slice(2));
  const sql = postgres(connectionString(), { max: 1, prepare: false });

  try {
    const operator = await activeOperator(sql);
    const resolution = {
      ...command.resolution,
      reviewedBy: operator.auth_subject,
    };
    const row = await preflightCommunityProductResearchTask(sql, resolution);
    const [task] = await sql<{
      id: string;
      task_kind: string;
      entity_label: string;
      status: string;
    }[]>`
      select task.id, task.task_kind, task.entity_label, task.status
      from community_research_tasks task
      where task.id = ${row.taskId} and task.entity_kind = 'product'
    `;
    if (!task) throw new Error('Community product research task does not exist.');

    const result = command.apply
      ? await resolveCommunityProductResearchTask(sql, resolution)
      : row;
    console.log(JSON.stringify({
      mode: command.apply ? 'applied' : 'dry-run',
      task: {
        id: task.id,
        kind: task.task_kind,
        label: task.entity_label,
        previousStatus: task.status,
      },
      resolution: result,
      writesCatalogue: false,
    }, null, command.json ? 0 : 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Community research resolution failed.');
  process.exitCode = 1;
});
