import 'server-only';

import { ModerationAccessError, type ModerationOperator, type ModerationRole } from './access';

// Capability layer between role and action (ADR 0007). Today all three roles pass
// the same entry gate and every writer is equally available; this maps each role
// to the writers in transitions.ts it may invoke. One capability per real writer —
// no inverse/un-approve exists, so none is modelled.
export type Capability =
  | 'observations.decide'
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
    'observations.decide', 'edges.decide', 'contributions.decide',
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
