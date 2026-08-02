import { z } from 'zod';
import { moderationQueueSchema, type ModerationQueue } from './schema';

const uuid = z.uuid();
const rationale = z.string().trim().min(1).max(2000);
const canonicalSlug = z.string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use the exact canonical slug.');

export type OperatorCommand =
  | { action: 'inspect'; apply: false; json: boolean }
  | {
      action: 'approve' | 'reject';
      queue: Extract<ModerationQueue,
        | 'community_contribution'
        | 'community_edge'
        | 'community_observation'
        | 'community_moderation_value'>;
      targetId: string;
      rationale: string;
      apply: boolean;
      json: boolean;
    }
  | {
      action: 'map';
      queue: 'community_moderation_value';
      targetId: string;
      canonicalEntityKind: 'purpose' | 'product' | 'brand' | 'retailer';
      canonicalEntityRef: string;
      rationale: string;
      apply: boolean;
      json: boolean;
    }
  | {
      action: 'claim' | 'defer' | 'retry' | 'note';
      queue: ModerationQueue;
      targetId: string;
      rationale: string;
      apply: boolean;
      json: boolean;
    }
  | {
      action: 'reconcile';
      queue: 'community_research_task';
      rationale: string;
      apply: boolean;
      json: boolean;
    }
  | {
      action: 'correct';
      queue: 'community_observation';
      targetId: string;
      disposition: 'defer' | 'reject';
      rationale: string;
      apply: boolean;
      json: boolean;
    };

const allowedFlags = new Set([
  'action',
  'queue',
  'target-id',
  'rationale',
  'canonical-kind',
  'canonical-ref',
  'disposition',
  'apply',
  'json',
]);

function readFlags(argv: string[]) {
  const flags = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!allowedFlags.has(key)) throw new Error(`Unknown flag: --${key}`);
    if (flags.has(key)) throw new Error(`Duplicate flag: --${key}`);
    if (key === 'apply' || key === 'json') {
      flags.set(key, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    flags.set(key, value);
    index += 1;
  }
  return flags;
}

function textFlag(flags: Map<string, string | true>, key: string): string | undefined {
  const value = flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function requireOnly(flags: Map<string, string | true>, keys: string[]) {
  const allowed = new Set([...keys, 'action', 'apply', 'json']);
  for (const key of flags.keys()) {
    if (!allowed.has(key)) throw new Error(`--${key} is not valid for this action.`);
  }
}

function required(flags: Map<string, string | true>, key: string) {
  const value = textFlag(flags, key);
  if (!value) throw new Error(`--${key} is required.`);
  return value;
}

export function parseOperatorCommand(argv: string[]): OperatorCommand {
  const flags = readFlags(argv);
  const action = z.enum([
    'inspect',
    'approve',
    'reject',
    'map',
    'claim',
    'defer',
    'retry',
    'note',
    'reconcile',
    'correct',
  ]).parse(textFlag(flags, 'action') ?? 'inspect');
  const apply = flags.get('apply') === true;
  const json = flags.get('json') === true;

  if (action === 'inspect') {
    requireOnly(flags, []);
    if (apply) throw new Error('--apply is not valid for a read-only inspection.');
    return { action, apply: false, json };
  }

  if (action === 'reconcile') {
    requireOnly(flags, ['rationale']);
    return {
      action,
      queue: 'community_research_task',
      rationale: rationale.parse(required(flags, 'rationale')),
      apply,
      json,
    };
  }

  if (action === 'map') {
    requireOnly(flags, ['queue', 'target-id', 'rationale', 'canonical-kind', 'canonical-ref']);
    const queue = moderationQueueSchema.parse(required(flags, 'queue'));
    if (queue !== 'community_moderation_value') {
      throw new Error('Mapping is available only for community_moderation_value.');
    }
    return {
      action,
      queue,
      targetId: uuid.parse(required(flags, 'target-id')),
      canonicalEntityKind: z.enum(['purpose', 'product', 'brand', 'retailer'])
        .parse(required(flags, 'canonical-kind')),
      canonicalEntityRef: canonicalSlug.parse(required(flags, 'canonical-ref')),
      rationale: rationale.parse(required(flags, 'rationale')),
      apply,
      json,
    };
  }

  if (action === 'correct') {
    requireOnly(flags, ['queue', 'target-id', 'rationale', 'disposition']);
    const queue = moderationQueueSchema.parse(required(flags, 'queue'));
    if (queue !== 'community_observation') {
      throw new Error('Correction is currently available only for community_observation.');
    }
    return {
      action,
      queue,
      targetId: uuid.parse(required(flags, 'target-id')),
      disposition: z.enum(['defer', 'reject']).parse(required(flags, 'disposition')),
      rationale: rationale.parse(required(flags, 'rationale')),
      apply,
      json,
    };
  }

  const queue = moderationQueueSchema.parse(required(flags, 'queue'));
  const targetId = uuid.parse(required(flags, 'target-id'));
  const parsedRationale = rationale.parse(required(flags, 'rationale'));
  requireOnly(flags, ['queue', 'target-id', 'rationale']);

  if (action === 'approve' || action === 'reject') {
    const decisionQueue = z.enum([
      'community_contribution',
      'community_edge',
      'community_observation',
      'community_moderation_value',
    ]).parse(queue);
    return { action, queue: decisionQueue, targetId, rationale: parsedRationale, apply, json };
  }

  if (action === 'retry' && queue !== 'community_research_task') {
    throw new Error('Retry is available only for community_research_task.');
  }

  return { action, queue, targetId, rationale: parsedRationale, apply, json };
}
