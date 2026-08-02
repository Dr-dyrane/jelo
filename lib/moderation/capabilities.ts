import 'server-only';

import { ModerationAccessError, type ModerationOperator, type ModerationRole } from './access';

// Capability layer between role and action (ADR 0007). All three roles pass the
// same entry gate, then this map narrows which writers each role may invoke. One
// capability per real writer;
// settled observation correction is deliberately separate from routine decisions.
export type Capability =
  | 'observations.decide'
  | 'observations.correct'
  | 'edges.decide'
  | 'contributions.decide'
  | 'retailers.decide'
  | 'vocabulary.decide'
  | 'vocabulary.map'
  | 'queue.note'
  | 'research.manage'
  | 'research.assign'
  | 'operators.manage';

const CAPABILITIES: Record<ModerationRole, Capability[]> = {
  moderator: ['observations.decide', 'edges.decide', 'queue.note'],
  operator: [
    'observations.decide', 'edges.decide', 'contributions.decide',
    'retailers.decide', 'vocabulary.decide', 'vocabulary.map', 'queue.note', 'research.manage',
  ],
  admin: [
    'observations.decide', 'observations.correct', 'edges.decide', 'contributions.decide',
    'retailers.decide', 'vocabulary.decide', 'vocabulary.map', 'queue.note',
    'research.manage', 'research.assign', 'operators.manage',
  ],
};

// Pure predicate — call it in an RSC to gate the UI (render controls absent or
// disabled), and pass the resulting booleans to client components.
export function can(role: ModerationRole, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

// Server gate — call after requireConsoleOperator(), before the writer. Never
// trusts the client.
export function assertCan(operator: ModerationOperator, capability: Capability): void {
  if (!can(operator.role, capability)) throw new ModerationAccessError();
}
