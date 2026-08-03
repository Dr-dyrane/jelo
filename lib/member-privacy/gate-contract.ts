export const MEMBER_PRIVACY_GATE_CONTRACT = 'jelocare-member-privacy-lifecycle';
export const MEMBER_PRIVACY_GATE_VERSION = 1;
export const MEMBER_PRIVACY_FOUNDATION_REVISION = '319ad03395632aa42207d137857e6018f1821b4e';
export const MEMBER_PRIVACY_TARGET_GATE = 'G0';

export const MEMBER_PRIVACY_STATUS_VALUES = [
  'blocked',
  'ready_for_human_review',
  'pass',
  'not_applicable',
] as const;

export const MEMBER_PRIVACY_REQUIREMENT_IDS = [
  'PRIV-001',
  'PRIV-002',
  'XFER-001',
  'DATA-001',
  'DATA-002',
  'DATA-003',
  'AUTH-001',
  'AUTH-002',
  'LIFE-001',
  'LIFE-002',
  'LIFE-003',
  'REST-001',
  'RIGHT-001',
  'RIGHT-002',
  'ADMIN-001',
  'OBS-001',
  'OBS-002',
  'OPS-001',
  'OPS-002',
  'REL-001',
  'REL-002',
  'REL-003',
] as const;

export const MEMBER_PRIVACY_G0_ROLES = [
  'privacy_legal_approver',
  'accountable_controller_executive',
  'data_administration_owner',
  'security_owner',
  'platform_delivery_owner',
  'incident_support_owner',
  'accessibility_reviewer',
  'procurement_provider_owner',
  'migration_data_owner',
] as const;

const DECISION_VALUES = ['approve', 'reject', 'approve_with_expiring_conditions'] as const;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const HUMAN_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’-]*(?:[ -][\p{L}\p{M}][\p{L}\p{M}'’-]*)+$/u;
const CONDITION_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const REPOSITORY_REFERENCE_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+(?:#[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)?$/;
const PLACEHOLDER_PATTERN = /(?:^|[\s_:/-])(unassigned|unknown|placeholder|example|sample|dummy|test|todo|tbd|to be filled|not assigned)(?:$|[\s_:/-])/i;

type MemberPrivacyStatus = typeof MEMBER_PRIVACY_STATUS_VALUES[number];
type MemberPrivacyRole = typeof MEMBER_PRIVACY_G0_ROLES[number];
type MemberPrivacyDecisionValue = typeof DECISION_VALUES[number];

export type MemberPrivacyRequirement = {
  id: typeof MEMBER_PRIVACY_REQUIREMENT_IDS[number];
  blocking: true;
  status: MemberPrivacyStatus;
  evidence: string[];
  requirement: string;
};

export type MemberPrivacyCondition = {
  id: string;
  summary: string;
  expires_at_utc: string;
  derived_from: string[];
};

export type MemberPrivacyHumanDecision = {
  gate: typeof MEMBER_PRIVACY_TARGET_GATE;
  role: MemberPrivacyRole;
  decision: MemberPrivacyDecisionValue;
  human_full_name: string;
  capacity_and_qualification: string;
  organisation: string;
  decision_date_utc: string;
  foundation_revision: string;
  implementation_revision: string;
  evidence_links: string[];
  signature_or_approval_record: string;
  conditions: MemberPrivacyCondition[];
};

export type MemberPrivacyGateRecord = {
  contract: typeof MEMBER_PRIVACY_GATE_CONTRACT;
  version: typeof MEMBER_PRIVACY_GATE_VERSION;
  foundation_revision: string;
  implementation_revision: string;
  target_gate: typeof MEMBER_PRIVACY_TARGET_GATE;
  authorised: boolean;
  status_values: MemberPrivacyStatus[];
  items: MemberPrivacyRequirement[];
  decisions: MemberPrivacyHumanDecision[];
};

export type MemberPrivacyGateVerification = {
  valid: boolean;
  eligible: boolean;
  authorised: boolean;
  targetGate: typeof MEMBER_PRIVACY_TARGET_GATE;
  invariantBlockers: string[];
  blockers: string[];
};

type VerificationOptions = {
  now?: Date;
};

const ROOT_KEYS = [
  'contract',
  'version',
  'foundation_revision',
  'implementation_revision',
  'target_gate',
  'authorised',
  'status_values',
  'items',
  'decisions',
] as const;
const REQUIREMENT_KEYS = ['id', 'blocking', 'status', 'evidence', 'requirement'] as const;
const DECISION_KEYS = [
  'gate',
  'role',
  'decision',
  'human_full_name',
  'capacity_and_qualification',
  'organisation',
  'decision_date_utc',
  'foundation_revision',
  'implementation_revision',
  'evidence_links',
  'signature_or_approval_record',
  'conditions',
] as const;
const CONDITION_KEYS = ['id', 'summary', 'expires_at_utc', 'derived_from'] as const;

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  issues: string[],
) {
  const actual = Object.keys(value);
  if (actual.some(key => !expected.includes(key))) issues.push(`invalid:${path}:unknown_keys`);
  if (expected.some(key => !Object.hasOwn(value, key))) issues.push(`invalid:${path}:missing_fields`);
}

function isNonPlaceholder(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && !PLACEHOLDER_PATTERN.test(value);
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && SHA_PATTERN.test(value);
}

function parseUtcDate(value: unknown) {
  if (typeof value !== 'string' || !UTC_DATE_PATTERN.test(value)) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value || canonical.replace('.000Z', 'Z') === value ? timestamp : null;
}

function isDurableReference(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  if (value.startsWith('https://')) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  return !value.includes('..') && REPOSITORY_REFERENCE_PATTERN.test(value);
}

function validateReferenceArray(value: unknown, path: string, issues: string[], requireEvidence: boolean) {
  if (!Array.isArray(value)) {
    issues.push(`invalid:${path}:not_array`);
    return;
  }
  if (requireEvidence && value.length === 0) issues.push(`invalid:${path}:empty`);
  if (value.some(reference => !isDurableReference(reference))) issues.push(`invalid:${path}:malformed_reference`);
  if (new Set(value).size !== value.length) issues.push(`invalid:${path}:duplicate_reference`);
}

function findConditionCycles(graph: Map<string, string[]>) {
  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (id: string): boolean => {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    active.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (visit(dependency)) return true;
    }
    active.delete(id);
    return false;
  };

  return [...graph.keys()].some(visit);
}

function invalidVerification(issues: string[]): MemberPrivacyGateVerification {
  const blockers = sortedUnique(issues);
  return {
    valid: false,
    eligible: false,
    authorised: false,
    targetGate: MEMBER_PRIVACY_TARGET_GATE,
    invariantBlockers: blockers,
    blockers,
  };
}

export function verifyMemberPrivacyGateRecord(
  input: unknown,
  options: VerificationOptions = {},
): MemberPrivacyGateVerification {
  const now = options.now ?? new Date();
  const issues: string[] = [];

  if (!isObject(input)) return invalidVerification(['invalid:record:not_object']);
  checkExactKeys(input, ROOT_KEYS, 'record', issues);

  if (input.contract !== MEMBER_PRIVACY_GATE_CONTRACT) issues.push('invalid:record:contract');
  if (input.version !== MEMBER_PRIVACY_GATE_VERSION) issues.push('invalid:record:version');
  if (input.foundation_revision !== MEMBER_PRIVACY_FOUNDATION_REVISION) {
    issues.push('invalid:record:foundation_revision');
  }
  if (!isSha(input.implementation_revision)) issues.push('invalid:record:implementation_revision');
  if (input.target_gate !== MEMBER_PRIVACY_TARGET_GATE) issues.push('invalid:record:target_gate');
  if (typeof input.authorised !== 'boolean') issues.push('invalid:record:authorised');

  if (!Array.isArray(input.status_values)) {
    issues.push('invalid:record:status_values');
  } else {
    const statuses = input.status_values;
    if (
      statuses.length !== MEMBER_PRIVACY_STATUS_VALUES.length
      || new Set(statuses).size !== statuses.length
      || statuses.some(status => !MEMBER_PRIVACY_STATUS_VALUES.includes(status as MemberPrivacyStatus))
    ) {
      issues.push('invalid:record:status_values');
    }
  }

  if (!Array.isArray(input.items)) {
    issues.push('invalid:items:not_array');
  } else {
    const ids: unknown[] = [];
    input.items.forEach((item, index) => {
      const path = `items[${index}]`;
      if (!isObject(item)) {
        issues.push(`invalid:${path}:not_object`);
        return;
      }
      checkExactKeys(item, REQUIREMENT_KEYS, path, issues);
      ids.push(item.id);
      if (!MEMBER_PRIVACY_REQUIREMENT_IDS.includes(item.id as MemberPrivacyRequirement['id'])) {
        issues.push(`invalid:${path}:id`);
      }
      if (item.blocking !== true) issues.push(`invalid:${path}:blocking`);
      if (!MEMBER_PRIVACY_STATUS_VALUES.includes(item.status as MemberPrivacyStatus)) {
        issues.push(`invalid:${path}:status`);
      }
      validateReferenceArray(item.evidence, `${path}:evidence`, issues, item.status === 'pass');
      if (!isNonPlaceholder(item.requirement)) issues.push(`invalid:${path}:requirement`);
    });
    if (new Set(ids).size !== ids.length) issues.push('invalid:items:duplicate_id');
    if (
      ids.length !== MEMBER_PRIVACY_REQUIREMENT_IDS.length
      || MEMBER_PRIVACY_REQUIREMENT_IDS.some(id => !ids.includes(id))
    ) {
      issues.push('invalid:items:requirement_set');
    }
  }

  const conditionGraph = new Map<string, string[]>();
  if (!Array.isArray(input.decisions)) {
    issues.push('invalid:decisions:not_array');
  } else {
    const roles: unknown[] = [];
    input.decisions.forEach((decision, decisionIndex) => {
      const path = `decisions[${decisionIndex}]`;
      if (!isObject(decision)) {
        issues.push(`invalid:${path}:not_object`);
        return;
      }
      checkExactKeys(decision, DECISION_KEYS, path, issues);
      roles.push(decision.role);
      if (decision.gate !== MEMBER_PRIVACY_TARGET_GATE) issues.push(`invalid:${path}:gate`);
      if (!MEMBER_PRIVACY_G0_ROLES.includes(decision.role as MemberPrivacyRole)) {
        issues.push(`invalid:${path}:role`);
      }
      if (!DECISION_VALUES.includes(decision.decision as MemberPrivacyDecisionValue)) {
        issues.push(`invalid:${path}:decision`);
      }
      if (typeof decision.human_full_name !== 'string'
        || !HUMAN_NAME_PATTERN.test(decision.human_full_name.trim())
        || !isNonPlaceholder(decision.human_full_name)) {
        issues.push(`invalid:${path}:human_full_name`);
      }
      if (!isNonPlaceholder(decision.capacity_and_qualification)) {
        issues.push(`invalid:${path}:capacity_and_qualification`);
      }
      if (!isNonPlaceholder(decision.organisation)) issues.push(`invalid:${path}:organisation`);
      if (parseUtcDate(decision.decision_date_utc) === null) {
        issues.push(`invalid:${path}:decision_date_utc`);
      }
      if (decision.foundation_revision !== input.foundation_revision) {
        issues.push(`invalid:${path}:foundation_revision_mismatch`);
      }
      if (!isSha(decision.implementation_revision)
        || decision.implementation_revision !== input.implementation_revision) {
        issues.push(`invalid:${path}:implementation_revision_mismatch`);
      }
      validateReferenceArray(decision.evidence_links, `${path}:evidence_links`, issues, true);
      if (!isDurableReference(decision.signature_or_approval_record)) {
        issues.push(`invalid:${path}:signature_or_approval_record`);
      }

      if (!Array.isArray(decision.conditions)) {
        issues.push(`invalid:${path}:conditions:not_array`);
        return;
      }
      if (decision.decision === 'approve_with_expiring_conditions' && decision.conditions.length === 0) {
        issues.push(`invalid:${path}:conditions:required`);
      }
      if (decision.decision !== 'approve_with_expiring_conditions' && decision.conditions.length > 0) {
        issues.push(`invalid:${path}:conditions:not_allowed`);
      }
      decision.conditions.forEach((condition, conditionIndex) => {
        const conditionPath = `${path}:conditions[${conditionIndex}]`;
        if (!isObject(condition)) {
          issues.push(`invalid:${conditionPath}:not_object`);
          return;
        }
        checkExactKeys(condition, CONDITION_KEYS, conditionPath, issues);
        if (typeof condition.id !== 'string' || !CONDITION_ID_PATTERN.test(condition.id)) {
          issues.push(`invalid:${conditionPath}:id`);
          return;
        }
        if (!isNonPlaceholder(condition.summary)) issues.push(`invalid:${conditionPath}:summary`);
        const expiry = parseUtcDate(condition.expires_at_utc);
        if (expiry === null) issues.push(`invalid:${conditionPath}:expires_at_utc`);
        else if (expiry <= now.getTime()) issues.push(`invalid:${conditionPath}:expired`);
        if (!Array.isArray(condition.derived_from)
          || condition.derived_from.some(reference => typeof reference !== 'string' || !CONDITION_ID_PATTERN.test(reference))) {
          issues.push(`invalid:${conditionPath}:derived_from`);
        } else {
          if (new Set(condition.derived_from).size !== condition.derived_from.length) {
            issues.push(`invalid:${conditionPath}:duplicate_derived_reference`);
          }
          if (conditionGraph.has(condition.id)) issues.push('invalid:conditions:duplicate_id');
          else conditionGraph.set(condition.id, condition.derived_from);
        }
      });
    });
    if (new Set(roles).size !== roles.length) issues.push('invalid:decisions:duplicate_role');
  }

  for (const dependencies of conditionGraph.values()) {
    if (dependencies.some(dependency => !conditionGraph.has(dependency))) {
      issues.push('invalid:conditions:missing_derived_reference');
    }
  }
  if (findConditionCycles(conditionGraph)) issues.push('invalid:conditions:transition_cycle');

  if (issues.length > 0) return invalidVerification(issues);

  const record = input as MemberPrivacyGateRecord;
  const invariantBlockers: string[] = [];
  for (const item of record.items) {
    if (item.blocking && item.status !== 'pass') {
      invariantBlockers.push(`requirement:${item.id}=${item.status}`);
    }
  }
  const decisionsByRole = new Map(record.decisions.map(decision => [decision.role, decision]));
  for (const role of MEMBER_PRIVACY_G0_ROLES) {
    const decision = decisionsByRole.get(role);
    if (!decision) invariantBlockers.push(`role:${role}=missing`);
    else if (decision.decision === 'reject') invariantBlockers.push(`role:${role}=reject`);
  }

  const sortedInvariantBlockers = sortedUnique(invariantBlockers);
  if (record.authorised && sortedInvariantBlockers.length > 0) {
    return invalidVerification([
      'invalid:record:authorised_true_with_unmet_invariants',
      ...sortedInvariantBlockers,
    ]);
  }

  const eligible = sortedInvariantBlockers.length === 0;
  const blockers = sortedUnique([
    ...sortedInvariantBlockers,
    ...(record.authorised ? [] : ['record:authorised=false']),
  ]);
  return {
    valid: true,
    eligible,
    authorised: eligible && record.authorised,
    targetGate: record.target_gate,
    invariantBlockers: sortedInvariantBlockers,
    blockers,
  };
}

export function formatMemberPrivacyGateVerification(
  verification: MemberPrivacyGateVerification,
  mode: 'review' | 'authorization',
) {
  if (!verification.valid) {
    return `${verification.targetGate} ${mode} invalid: ${verification.blockers.join(', ')}`;
  }
  if (mode === 'review') {
    if (!verification.authorised && !verification.eligible && verification.invariantBlockers.length > 0) {
      return `${verification.targetGate} review valid: honestly blocked (${verification.invariantBlockers.length} blockers).`;
    }
    return `${verification.targetGate} review blocked: review mode requires authorised=false with at least one unmet invariant.`;
  }
  if (verification.authorised) return `${verification.targetGate} authorization valid: authorised.`;
  return `${verification.targetGate} authorization blocked: ${verification.blockers.join(', ')}`;
}

export function memberPrivacyGateExitCode(
  verification: MemberPrivacyGateVerification,
  mode: 'review' | 'authorization',
) {
  if (!verification.valid) return 1;
  if (mode === 'review') {
    return !verification.authorised && !verification.eligible && verification.invariantBlockers.length > 0 ? 0 : 1;
  }
  return verification.authorised ? 0 : 1;
}
