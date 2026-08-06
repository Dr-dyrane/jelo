import { describe, it, expect } from 'vitest';
import { concerns } from '@/data/knowledge';
import type { Concern } from '@/data/knowledge';
import { matchConcerns } from '@/lib/customer/concern-matching';

const bySlug = (slug: string) => concerns.find(item => item.slug === slug)!;

describe('matchConcerns', () => {
  it('returns a name match with matchedTerms containing the name', () => {
    const matches = matchConcerns('acne', concerns);
    const acne = matches.find(item => item.concern.slug === 'acne-breakouts');
    expect(acne).toBeDefined();
    expect(acne!.matchedTerms).toContain('Acne & breakouts');
  });

  it('returns a productTerm match with the matched term', () => {
    const matches = matchConcerns('blackheads', concerns);
    const acne = matches.find(item => item.concern.slug === 'acne-breakouts');
    expect(acne).toBeDefined();
    expect(acne!.matchedTerms).toContain('blackheads');
  });

  it('returns a signal match with the matched signal', () => {
    const matches = matchConcerns('flaking', concerns);
    const sensitive = matches.find(item => item.concern.slug === 'sensitive-barrier');
    expect(sensitive).toBeDefined();
    expect(sensitive!.matchedSignals).toContain('flaking');
  });

  it('returns a condition-pattern even with productTerms: []', () => {
    const ringworm = bySlug('ringworm-pattern');
    expect(ringworm.productTerms).toEqual([]);
    expect(ringworm.kind).toBe('condition-pattern');

    const matches = matchConcerns('ringworm', concerns);
    const found = matches.find(item => item.concern.slug === 'ringworm-pattern');
    expect(found).toBeDefined();
    expect(found!.concern.productTerms).toEqual([]);
    expect(found!.concern.kind).toBe('condition-pattern');
  });

  it('returns an empty array when nothing matches', () => {
    expect(matchConcerns('zzz-no-such-concern-zzz', concerns)).toEqual([]);
  });

  it('returns an empty array for empty search', () => {
    expect(matchConcerns('', concerns)).toEqual([]);
  });

  it('returns an empty array for whitespace-only search', () => {
    expect(matchConcerns('   \t  \n ', concerns)).toEqual([]);
  });

  it('matches across name, terms, and signals for multi-word search', () => {
    const matches = matchConcerns('acne blackheads flaking', concerns);
    const acne = matches.find(item => item.concern.slug === 'acne-breakouts');
    expect(acne).toBeDefined();
    expect(acne!.matchedTerms).toContain('Acne & breakouts');
    expect(acne!.matchedTerms).toContain('blackheads');
    expect(acne!.matchedSignals.length).toBeGreaterThan(0);
  });

  it('ranks name matches above productTerm matches above signal matches', () => {
    // "dry" hits: dry-dehydrated-skin (name), dandruff-itchy-scalp (productTerm "dry scalp"),
    // and keratosis-pilaris-pattern (signal "dryness").
    const matches = matchConcerns('dry', concerns);
    const indexOf = (slug: string) => matches.findIndex(item => item.concern.slug === slug);

    const nameIdx = indexOf('dry-dehydrated-skin');
    const termIdx = indexOf('dandruff-itchy-scalp');
    const signalIdx = indexOf('keratosis-pilaris-pattern');

    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(termIdx).toBeGreaterThanOrEqual(0);
    expect(signalIdx).toBeGreaterThanOrEqual(0);

    expect(nameIdx).toBeLessThan(termIdx);
    expect(termIdx).toBeLessThan(signalIdx);
  });

  it('matches case-insensitively', () => {
    const lower = matchConcerns('acne', concerns);
    const upper = matchConcerns('ACNE', concerns);
    const mixed = matchConcerns('AcNe', concerns);
    expect(upper.map(item => item.concern.slug)).toEqual(lower.map(item => item.concern.slug));
    expect(mixed.map(item => item.concern.slug)).toEqual(lower.map(item => item.concern.slug));
  });

  it('is pure — no side effects and stable across repeated calls', () => {
    const snapshot = JSON.stringify(concerns);
    const a = matchConcerns('acne', concerns);
    const b = matchConcerns('dry skin', concerns);
    const c = matchConcerns('acne', concerns);
    expect(a).toEqual(c);
    expect(JSON.stringify(concerns)).toBe(snapshot);
    expect(a).not.toBe(c);
    expect(b).toBeDefined();
  });

  it('does not throw for malformed input', () => {
    expect(() => matchConcerns(null as unknown as string, concerns)).not.toThrow();
    expect(() => matchConcerns(undefined as unknown as string, concerns)).not.toThrow();
    expect(() => matchConcerns(123 as unknown as string, concerns)).not.toThrow();
    expect(() => matchConcerns({} as unknown as string, concerns)).not.toThrow();
    expect(() => matchConcerns('acne', null as unknown as Concern[])).not.toThrow();
    expect(() => matchConcerns('acne', undefined as unknown as Concern[])).not.toThrow();
    expect(() => matchConcerns('acne', 'not-an-array' as unknown as Concern[])).not.toThrow();
    expect(() => matchConcerns('acne', [{ bad: true }] as unknown as Concern[])).not.toThrow();

    expect(matchConcerns(null as unknown as string, concerns)).toEqual([]);
    expect(matchConcerns('acne', null as unknown as Concern[])).toEqual([]);
    expect(matchConcerns('123', concerns)).toEqual([]);
  });
});
