import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';

test('provides sourced concern guidance without turning condition patterns into product matches', () => {
  assert.ok(concerns.length >= 26);
  assert.equal(new Set(concerns.map(concern => concern.slug)).size, concerns.length);

  for (const concern of concerns) {
    assert.ok(concern.signals.length > 0, concern.slug);
    assert.ok(concern.escalation.length > 0, concern.slug);
    assert.ok(concern.sources.length > 0, concern.slug);
    assert.match(concern.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const source of concern.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(
        url.hostname === 'www.aad.org' || url.hostname === 'www.nhs.uk' || url.hostname === 'www.who.int',
        source.url,
      );
    }
    if (concern.kind === 'condition-pattern') {
      assert.deepEqual(concern.productTerms, [], `${concern.slug} must not drive product recommendations`);
    }
  }
});

test('infection warning guides preserve time-sensitive referral and stop product matching', () => {
  const cluster = [
    {
      slug: 'cellulitis-pattern',
      source: 'https://www.nhs.uk/conditions/cellulitis/',
      escalationTerms: ['urgent same-day', 'emergency services', 'fast breathing', 'confusion'],
    },
    {
      slug: 'impetigo-pattern',
      source: 'https://www.nhs.uk/conditions/impetigo/',
      escalationTerms: ['baby under 1', 'weakened immunity', 'breastfeeding', 'urgent care'],
    },
    {
      slug: 'shingles-pattern',
      source: 'https://www.nhs.uk/conditions/shingles/',
      escalationTerms: ['within 3 days', 'vision changes', 'pregnancy', 'weakened immunity'],
    },
  ];

  for (const expected of cluster) {
    const concern = concerns.find(item => item.slug === expected.slug);
    assert.ok(concern, expected.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), [expected.source]);
    for (const term of expected.escalationTerms) {
      assert.ok(concern.escalation.toLowerCase().includes(term), `${expected.slug} is missing ${term}`);
    }
  }
});

test('numb skin patches stop product matching and route sensory loss to an examination', () => {
  const concern = concerns.find(item => item.slug === 'leprosy-pattern');
  assert.ok(concern);
  assert.equal(concern.name, 'Numb skin patches');
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.productTerms, []);
  assert.deepEqual(concern.sources.map(source => source.url), [
    'https://www.who.int/en/news-room/fact-sheets/detail/leprosy',
    'https://www.nhs.uk/conditions/stroke/symptoms/',
  ]);
  for (const term of ['reduced feeling', 'numbness', 'nerve', 'sudden one-sided', 'speech trouble', 'emergency care', 'permanent disability']) {
    assert.ok(
      `${concern.summary} ${concern.escalation}`.toLowerCase().includes(term),
      `numb skin patches is missing ${term}`,
    );
  }
  assert.doesNotMatch(
    `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`,
    /needle|sharp object|heat test/i,
  );
  assert.doesNotMatch(concern.signals.join(' '), /near the patch/i);
});

test('dark velvety skin routes underlying-cause review instead of pigmentation shopping', () => {
  const concern = concerns.find(item => item.slug === 'acanthosis-nigricans-pattern');
  assert.ok(concern);
  assert.equal(concern.name, 'Dark, velvety skin');
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.productTerms, []);
  assert.deepEqual(concern.sources.map(source => source.url), [
    'https://www.aad.org/public/diseases/a-z/acanthosis-nigricans-overview',
    'https://www.aad.org/public/diseases/a-z/acanthosis-nigricans-treatment',
  ]);
  const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
  for (const term of ['velvety', 'does not scrub away', 'medical review', 'prediabetes', 'skincare cannot confirm']) {
    assert.ok(guidance.includes(term), `dark velvety skin is missing ${term}`);
  }
  assert.doesNotMatch(guidance, /brighten|bleach|lighten|fade|whiten/i);
});
