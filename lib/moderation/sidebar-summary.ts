import 'server-only';

import type { ModerationOperator } from './access';

export type OpsSidebarSummary = {
  displayName: string;
  email: string;
  decisionsToday: number;
  lastActionLabel: string;
};

const mockSummaries: Record<ModerationOperator['role'], OpsSidebarSummary> = {
  moderator: {
    displayName: 'Amina Okafor',
    email: 'amina.okafor@ops.example',
    decisionsToday: 5,
    lastActionLabel: '22m ago',
  },
  operator: {
    displayName: 'Chidi Okoye',
    email: 'chidi.okoye@ops.example',
    decisionsToday: 8,
    lastActionLabel: '14m ago',
  },
  admin: {
    displayName: 'Ifeoma Nwosu',
    email: 'ifeoma.nwosu@ops.example',
    decisionsToday: 12,
    lastActionLabel: '8m ago',
  },
};

export function getMockOpsSidebarSummary(operator: ModerationOperator): OpsSidebarSummary {
  return mockSummaries[operator.role];
}
