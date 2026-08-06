import type { Concern } from '@/data/knowledge';

export type ConcernMatch = {
  concern: Concern;
  matchedTerms: string[];
  matchedSignals: string[];
};

/**
 * Pure concern-matching function for the Consult experience (ADR 0015, Slice 1).
 *
 * Maps free search text to reviewed concern content from the knowledge library.
 * It never calls `new Date()`, never touches React, storage, network, or AI, and
 * never throws for malformed input.
 *
 * Ranking: name (and slug) match > productTerm match > signal match.
 * Condition-patterns (`productTerms: []`) still surface via name, slug, and
 * signal matches so escalation guidance is reachable even when no products are
 * eligible.
 */
export function matchConcerns(
  search: unknown,
  concerns: unknown,
): ConcernMatch[] {
  if (typeof search !== 'string') return [];
  if (!Array.isArray(concerns)) return [];

  const normalized = search.trim().toLowerCase();
  if (normalized === '') return [];

  // Split on whitespace; drop empty fragments and single-character noise.
  const words = normalized.split(/\s+/).filter(word => word.length >= 2);
  if (words.length === 0) return [];

  type Scored = ConcernMatch & { score: number; index: number };

  const results: Scored[] = [];

  for (let i = 0; i < concerns.length; i += 1) {
    const concern = concerns[i] as Concern;
    if (!concern || typeof concern !== 'object') continue;

    const name = typeof concern.name === 'string' ? concern.name.toLowerCase() : '';
    const slug = typeof concern.slug === 'string' ? concern.slug.toLowerCase() : '';
    const productTerms = Array.isArray(concern.productTerms) ? concern.productTerms : [];
    const signals = Array.isArray(concern.signals) ? concern.signals : [];

    const matchedTerms: string[] = [];
    const matchedSignals: string[] = [];

    let nameMatched = false;
    let termMatched = false;
    let signalMatched = false;

    for (const word of words) {
      if (name.includes(word)) {
        nameMatched = true;
      }
      if (slug.includes(word)) {
        nameMatched = true;
      }

      for (const term of productTerms) {
        if (typeof term !== 'string') continue;
        const lowered = term.toLowerCase();
        if (lowered.includes(word) || word.includes(lowered)) {
          termMatched = true;
          if (!matchedTerms.includes(term)) matchedTerms.push(term);
        }
      }

      for (const signal of signals) {
        if (typeof signal !== 'string') continue;
        const lowered = signal.toLowerCase();
        if (lowered.includes(word) || word.includes(lowered)) {
          signalMatched = true;
          if (!matchedSignals.includes(signal)) matchedSignals.push(signal);
        }
      }
    }

    if (nameMatched && !matchedTerms.includes(concern.name)) {
      matchedTerms.unshift(concern.name);
    }

    let score = 0;
    if (nameMatched) score = 3;
    else if (termMatched) score = 2;
    else if (signalMatched) score = 1;

    if (score === 0) continue;

    results.push({
      concern,
      matchedTerms,
      matchedSignals,
      score,
      index: i,
    });
  }

  // Stable sort by score descending, preserving original library order on ties.
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return results.map(({ concern, matchedTerms, matchedSignals }) => ({
    concern,
    matchedTerms,
    matchedSignals,
  }));
}
