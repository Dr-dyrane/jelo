// Community-observation outcome labels + tones, mirrored exactly from the public
// contribution flow (components/contribute/contribution-experience.tsx:34-39) so
// the operator sees the same words the contributor chose.
export type OutcomeTone = 'success' | 'warning' | 'danger';

const LABELS: Record<string, string> = {
  'love-it': 'Love it',
  helped: 'Helped',
  unsure: 'Not sure',
  'didnt-help': 'Didn’t help',
};

const TONES: Record<string, OutcomeTone> = {
  'love-it': 'success',
  helped: 'success',
  unsure: 'warning',
  'didnt-help': 'danger',
};

export function outcomeLabel(outcome: string): string {
  return LABELS[outcome] ?? outcome;
}

export function outcomeTone(outcome: string): OutcomeTone {
  return TONES[outcome] ?? 'warning';
}
