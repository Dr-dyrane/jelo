export const communityPurposeLabels = [
  'Acne',
  'Dark spots',
  'Oily skin',
  'Dry skin',
  'Normal skin',
  'Sensitive skin',
  'Hair',
  'Body',
] as const;

export function communityOptionId(prefix: string, value: string) {
  return `${prefix}:${value
    .normalize('NFKD')
    .toLocaleLowerCase('en-NG')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export const communityPurposeOptions = communityPurposeLabels.map(label => ({
  id: communityOptionId('purpose', label),
  label,
}));
