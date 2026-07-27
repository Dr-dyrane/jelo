import { z } from 'zod';
import {
  communityProductResearchResolutionSchema,
  communityResearchResolutionOutcomes,
  type CommunityProductResearchResolutionInput,
} from './research-resolution';

const allowedFlags = new Set([
  'task-id',
  'outcome',
  'canonical-slug',
  'candidate-id',
  'rationale',
  'metadata-json',
  'apply',
  'json',
]);

function flagsFrom(argv: string[]) {
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

function required(flags: Map<string, string | true>, key: string) {
  const value = flags.get(key);
  if (typeof value !== 'string') throw new Error(`--${key} is required.`);
  return value;
}

function optional(flags: Map<string, string | true>, key: string) {
  const value = flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function metadata(flags: Map<string, string | true>) {
  const raw = optional(flags, 'metadata-json');
  if (!raw) return { source: 'community-research-resolution-cli' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('--metadata-json must be valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--metadata-json must be a JSON object.');
  }
  return { ...value as Record<string, unknown>, source: 'community-research-resolution-cli' };
}

export type CommunityResearchResolutionCommand = {
  resolution: CommunityProductResearchResolutionInput extends infer Resolution
    ? Resolution extends CommunityProductResearchResolutionInput
      ? Omit<Resolution, 'reviewedBy'>
      : never
    : never;
  apply: boolean;
  json: boolean;
};

export function parseCommunityResearchResolutionCommand(
  argv: string[],
): CommunityResearchResolutionCommand {
  const flags = flagsFrom(argv);
  const outcome = z.enum(communityResearchResolutionOutcomes)
    .parse(required(flags, 'outcome'));
  const shared = {
    taskId: required(flags, 'task-id'),
    outcome,
    rationale: required(flags, 'rationale'),
    auditMetadata: metadata(flags),
  };
  const canonicalSlug = optional(flags, 'canonical-slug');
  const candidateId = optional(flags, 'candidate-id');
  if (outcome === 'existing-canonical-product' && candidateId) {
    throw new Error('--candidate-id is not valid for an existing canonical product.');
  }
  if (outcome === 'deliberate-intake-candidate' && canonicalSlug) {
    throw new Error('--canonical-slug is not valid for a deliberate intake candidate.');
  }
  if ((outcome === 'ambiguous-family' || outcome === 'bundle') && (canonicalSlug || candidateId)) {
    throw new Error(`Catalogue targets are not valid for ${outcome}.`);
  }
  const resolution = outcome === 'existing-canonical-product'
    ? { ...shared, canonicalSlug }
    : outcome === 'deliberate-intake-candidate'
      ? { ...shared, candidateId }
      : outcome === 'dismissed-duplicate'
        ? { ...shared, canonicalSlug, candidateId }
        : { ...shared };

  // Supply a bounded placeholder only to reuse the exact domain validation.
  // The authenticated script replaces it with the allowlisted operator subject.
  communityProductResearchResolutionSchema.parse({
    ...resolution,
    reviewedBy: 'command-validation',
  });

  return {
    resolution: resolution as CommunityResearchResolutionCommand['resolution'],
    apply: flags.get('apply') === true,
    json: flags.get('json') === true,
  };
}
