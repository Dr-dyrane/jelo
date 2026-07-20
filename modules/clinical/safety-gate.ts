const urgentPatterns = [
  /difficulty breathing/i,
  /swollen (face|lips|tongue|throat)/i,
  /eyes? (pain|swollen|affected)/i,
  /rapidly spreading/i,
  /fever/i,
  /blister/i,
  /skin peeling/i,
  /severe pain/i,
  /pus.*fever/i,
  /pregnan/i,
  /infant|newborn/i,
];

export type SafetyInput = { symptoms: string[]; durationDays?: number };

export function assessRedFlags(input: SafetyInput) {
  const text = input.symptoms.join(' ');
  const matches = urgentPatterns.filter(pattern => pattern.test(text)).map(pattern => pattern.source);
  return {
    level: matches.length ? 'clinician-review' : 'self-care-eligible',
    matchedSignals: matches,
    instruction: matches.length
      ? 'Do not recommend products as the primary response. Advise prompt assessment by a qualified clinician.'
      : 'Proceed with conservative educational guidance and catalogue matching.',
  } as const;
}
