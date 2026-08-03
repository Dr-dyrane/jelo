import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MEMBER_PRIVACY_G0_ROLES,
  MEMBER_PRIVACY_REQUIREMENT_IDS,
  type MemberPrivacyGateRecord,
  type MemberPrivacyHumanDecision,
  verifyMemberPrivacyGateRecord,
} from '../../lib/member-privacy/gate-contract';
import { runMemberPrivacyGateCli } from '../../scripts/verify-member-privacy-gate';

const FOUNDATION_REVISION = '319ad03395632aa42207d137857e6018f1821b4e';
const IMPLEMENTATION_REVISION = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NOW = new Date('2026-08-01T00:00:00Z');
const realRecord = JSON.parse(
  readFileSync('data/member-privacy/gates/g0.json', 'utf8'),
) as MemberPrivacyGateRecord;

const humanNames = [
  'Adaeze Okafor',
  'Chinedu Balogun',
  'Imani Adeyemi',
  'Tunde Bello',
  'Nneka Obi',
  'Amina Yusuf',
  'Kelechi Eze',
  'Folake Ogunleye',
  'Bisi Adebayo',
] as const;

function completeDecision(role: typeof MEMBER_PRIVACY_G0_ROLES[number], index: number): MemberPrivacyHumanDecision {
  return {
    gate: 'G0',
    role,
    decision: 'approve',
    human_full_name: humanNames[index],
    capacity_and_qualification: `Recorded ${role.replaceAll('_', ' ')} capacity and qualification`,
    organisation: 'JeloCare Foundation',
    decision_date_utc: '2026-07-31T12:00:00Z',
    foundation_revision: FOUNDATION_REVISION,
    implementation_revision: IMPLEMENTATION_REVISION,
    evidence_links: [`https://evidence.jelocare.invalid/g0/${role}`],
    signature_or_approval_record: `https://approvals.jelocare.invalid/g0/${role}`,
    conditions: [],
  };
}

function completeRecord(): MemberPrivacyGateRecord {
  return {
    ...structuredClone(realRecord),
    implementation_revision: IMPLEMENTATION_REVISION,
    authorised: true,
    items: realRecord.items.map(item => ({
      ...item,
      status: 'pass',
      evidence: [`https://evidence.jelocare.invalid/g0/${item.id.toLowerCase()}`],
    })),
    decisions: MEMBER_PRIVACY_G0_ROLES.map(completeDecision),
  };
}

function verificationAfter(mutate: (record: MemberPrivacyGateRecord) => void) {
  const record = completeRecord();
  mutate(record);
  return verifyMemberPrivacyGateRecord(record, { now: NOW });
}

test('the real G0 record preserves all requirements and validates as honestly blocked', () => {
  const verification = verifyMemberPrivacyGateRecord(realRecord, { now: NOW });
  assert.equal(verification.valid, true);
  assert.equal(verification.authorised, false);
  assert.equal(realRecord.authorised, false);
  assert.equal(realRecord.foundation_revision, FOUNDATION_REVISION);
  assert.deepEqual(realRecord.items.map(item => item.id), [...MEMBER_PRIVACY_REQUIREMENT_IDS]);
  assert.equal(realRecord.items.filter(item => item.status === 'ready_for_human_review').length, 2);
  assert.equal(realRecord.items.filter(item => item.status === 'blocked').length, 20);
  assert.equal(verification.invariantBlockers.length, 31);
});

test('a wholly synthetic complete record is the only authorising shape', () => {
  const verification = verifyMemberPrivacyGateRecord(completeRecord(), { now: NOW });
  assert.deepEqual(verification, {
    valid: true,
    eligible: true,
    authorised: true,
    targetGate: 'G0',
    invariantBlockers: [],
    blockers: [],
  });
});

test('every blocking requirement must pass', () => {
  const verification = verificationAfter(record => {
    record.authorised = false;
    record.items[0].status = 'ready_for_human_review';
  });
  assert.equal(verification.valid, true);
  assert.equal(verification.eligible, false);
  assert.ok(verification.blockers.includes('requirement:PRIV-001=ready_for_human_review'));
});

test('every required G0 human role must be present and approving', () => {
  const missing = verificationAfter(record => {
    record.authorised = false;
    record.decisions.pop();
  });
  assert.ok(missing.blockers.includes('role:migration_data_owner=missing'));

  const rejected = verificationAfter(record => {
    record.authorised = false;
    record.decisions[0].decision = 'reject';
  });
  assert.ok(rejected.blockers.includes('role:privacy_legal_approver=reject'));
});

test('requirement pass and human decisions both require durable evidence', () => {
  const passWithoutEvidence = verificationAfter(record => {
    record.items[0].evidence = [];
  });
  assert.ok(passWithoutEvidence.blockers.includes('invalid:items[0]:evidence:empty'));

  const decisionWithoutEvidence = verificationAfter(record => {
    record.decisions[0].evidence_links = [];
  });
  assert.ok(decisionWithoutEvidence.blockers.includes('invalid:decisions[0]:evidence_links:empty'));

  const malformedUrl = verificationAfter(record => {
    record.decisions[0].evidence_links = ['http://evidence.invalid/not-durable'];
  });
  assert.ok(malformedUrl.blockers.includes('invalid:decisions[0]:evidence_links:malformed_reference'));
});

test('human decisions require a durable signature or approval record', () => {
  const verification = verificationAfter(record => {
    record.decisions[0].signature_or_approval_record = '';
  });
  assert.ok(verification.blockers.includes('invalid:decisions[0]:signature_or_approval_record'));
});

test('decision and record revisions must be valid and match', () => {
  const malformed = verificationAfter(record => {
    record.decisions[0].implementation_revision = 'not-a-sha';
  });
  assert.ok(malformed.blockers.includes('invalid:decisions[0]:implementation_revision_mismatch'));

  const mismatched = verificationAfter(record => {
    record.decisions[0].implementation_revision = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  });
  assert.ok(mismatched.blockers.includes('invalid:decisions[0]:implementation_revision_mismatch'));

  const wrongFoundation = verificationAfter(record => {
    record.foundation_revision = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  });
  assert.ok(wrongFoundation.blockers.includes('invalid:record:foundation_revision'));
});

test('conditional approvals require unexpired, acyclic condition evidence', () => {
  const expired = verificationAfter(record => {
    record.decisions[0].decision = 'approve_with_expiring_conditions';
    record.decisions[0].conditions = [{
      id: 'COND_A',
      summary: 'Complete the recorded follow-up control',
      expires_at_utc: '2026-07-31T23:59:59Z',
      derived_from: [],
    }];
  });
  assert.ok(expired.blockers.includes('invalid:decisions[0]:conditions[0]:expired'));

  const cycle = verificationAfter(record => {
    record.decisions[0].decision = 'approve_with_expiring_conditions';
    record.decisions[0].conditions = [{
      id: 'COND_A',
      summary: 'Complete the first recorded follow-up control',
      expires_at_utc: '2027-08-01T00:00:00Z',
      derived_from: ['COND_B'],
    }, {
      id: 'COND_B',
      summary: 'Complete the second recorded follow-up control',
      expires_at_utc: '2027-08-01T00:00:00Z',
      derived_from: ['COND_A'],
    }];
  });
  assert.ok(cycle.blockers.includes('invalid:conditions:transition_cycle'));
});

test('missing condition references and missing conditional evidence are rejected', () => {
  const missingCondition = verificationAfter(record => {
    record.decisions[0].decision = 'approve_with_expiring_conditions';
  });
  assert.ok(missingCondition.blockers.includes('invalid:decisions[0]:conditions:required'));

  const missingReference = verificationAfter(record => {
    record.decisions[0].decision = 'approve_with_expiring_conditions';
    record.decisions[0].conditions = [{
      id: 'COND_A',
      summary: 'Complete the recorded follow-up control',
      expires_at_utc: '2027-08-01T00:00:00Z',
      derived_from: ['COND_MISSING'],
    }];
  });
  assert.ok(missingReference.blockers.includes('invalid:conditions:missing_derived_reference'));
});

test('unknown keys, statuses, duplicate requirement IDs, and duplicate roles are rejected', () => {
  const unknownKey = verificationAfter(record => {
    Object.assign(record, { unexpected: true });
  });
  assert.ok(unknownKey.blockers.includes('invalid:record:unknown_keys'));

  const unknownStatus = verificationAfter(record => {
    record.items[0].status = 'unknown' as never;
  });
  assert.ok(unknownStatus.blockers.includes('invalid:items[0]:status'));

  const duplicateRequirement = verificationAfter(record => {
    record.items[1].id = record.items[0].id;
  });
  assert.ok(duplicateRequirement.blockers.includes('invalid:items:duplicate_id'));

  const duplicateRole = verificationAfter(record => {
    record.decisions[1].role = record.decisions[0].role;
  });
  assert.ok(duplicateRole.blockers.includes('invalid:decisions:duplicate_role'));
});

test('missing human fields, placeholders, malformed UTC dates, and wrong gates are rejected', () => {
  const missingField = verificationAfter(record => {
    delete (record.decisions[0] as Partial<MemberPrivacyHumanDecision>).organisation;
  });
  assert.ok(missingField.blockers.includes('invalid:decisions[0]:missing_fields'));

  for (const field of ['human_full_name', 'capacity_and_qualification', 'organisation'] as const) {
    const placeholder = verificationAfter(record => {
      record.decisions[0][field] = 'UNASSIGNED';
    });
    assert.ok(placeholder.blockers.includes(`invalid:decisions[0]:${field}`));
  }

  const testName = verificationAfter(record => {
    record.decisions[0].human_full_name = 'Test User';
  });
  assert.ok(testName.blockers.includes('invalid:decisions[0]:human_full_name'));

  const malformedDate = verificationAfter(record => {
    record.decisions[0].decision_date_utc = '2026-02-31T12:00:00Z';
  });
  assert.ok(malformedDate.blockers.includes('invalid:decisions[0]:decision_date_utc'));

  const wrongGate = verificationAfter(record => {
    record.decisions[0].gate = 'G1' as never;
  });
  assert.ok(wrongGate.blockers.includes('invalid:decisions[0]:gate'));
});

test('authorised=true is invalid whenever any authorization invariant is unmet', () => {
  const record = structuredClone(realRecord);
  record.authorised = true;
  const verification = verifyMemberPrivacyGateRecord(record, { now: NOW });
  assert.equal(verification.valid, false);
  assert.ok(verification.blockers.includes('invalid:record:authorised_true_with_unmet_invariants'));
});

test('review CLI succeeds only for the honestly blocked real record', async () => {
  const result = await runMemberPrivacyGateCli(['--mode=review'], { now: NOW });
  assert.deepEqual(result, {
    exitCode: 0,
    line: 'G0 review valid: honestly blocked (31 blockers).',
  });
});

test('authorization CLI fails closed with the exact sorted blocker summary', async () => {
  const result = await runMemberPrivacyGateCli(['--mode=authorization'], { now: NOW });
  const blockers = [
    'record:authorised=false',
    ...realRecord.items.map(item => `requirement:${item.id}=${item.status}`),
    ...MEMBER_PRIVACY_G0_ROLES.map(role => `role:${role}=missing`),
  ].sort((left, right) => left.localeCompare(right));
  assert.equal(result.exitCode, 1);
  assert.equal(result.line, `G0 authorization blocked: ${blockers.join(', ')}`);
});

test('CLI rejects ambiguous modes without reading or emitting record data', async () => {
  const result = await runMemberPrivacyGateCli(['--mode=review', '--mode=authorization']);
  assert.deepEqual(result, {
    exitCode: 1,
    line: 'G0 verifier invalid: invalid:cli:arguments',
  });
});
