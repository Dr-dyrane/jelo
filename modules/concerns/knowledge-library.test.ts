import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import { differentialPatternIds } from '@/modules/clinical/core/differential';

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

test('every condition guide maps to a deterministic Ask Jelo pattern', () => {
  const available = new Set(differentialPatternIds);

  for (const concern of concerns) {
    if (concern.kind === 'concern') {
      assert.equal(concern.clinicalPatternIds, undefined, concern.slug);
      continue;
    }

    assert.ok(concern.clinicalPatternIds.length > 0, `${concern.slug} needs a deterministic pattern`);
    for (const patternId of concern.clinicalPatternIds) {
      assert.ok(available.has(patternId), `${concern.slug} references missing pattern ${patternId}`);
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

test('next condition guides preserve examination-first care and authoritative sources', () => {
  const expected = [
    {
      slug: 'scalp-ringworm-pattern',
      pattern: 'tinea-capitis-like',
      sources: ['https://www.nhs.uk/conditions/ringworm/'],
      terms: ['prescription treatment', 'in-person review'],
    },
    {
      slug: 'keloid-scar-pattern',
      pattern: 'keloid-scar-like',
      sources: [
        'https://www.aad.org/public/diseases/a-z/keloids-overview',
        'https://www.aad.org/public/diseases/a-z/keloids-treatment',
      ],
      terms: ['examination', 'grows quickly'],
    },
    {
      slug: 'mpox-pattern',
      pattern: 'mpox-like',
      sources: ['https://www.who.int/news-room/fact-sheets/detail/mpox'],
      terms: ['avoid close contact', 'urgent medical care'],
    },
    {
      slug: 'medicine-rash-warning-pattern',
      pattern: 'severe-medicine-reaction-like',
      sources: ['https://www.nhs.uk/conditions/stevens-johnson-syndrome/'],
      terms: ['emergency hospital care now', 'after a medicine'],
    },
    {
      slug: 'painless-ulcer-pattern',
      pattern: 'painless-ulcer-like',
      sources: ['https://www.who.int/en/news-room/fact-sheets/detail/buruli-ulcer-%28mycobacterium-ulcerans-infection%29'],
      terms: ['in-person medical examination', 'rapid enlargement'],
    },
    {
      slug: 'wart-like-ulcer-pattern',
      pattern: 'infectious-papilloma-ulcer-like',
      sources: [
        'https://www.who.int/en/news-room/fact-sheets/detail/yaws',
        'https://www.who.int/publications/i/item/9789292800024',
      ],
      terms: ['prompt in-person examination', 'avoid direct skin contact'],
    },
    {
      slug: 'slow-swelling-drainage-pattern',
      pattern: 'deep-draining-mass-like',
      sources: [
        'https://www.who.int/news-room/fact-sheets/detail/mycetoma',
        'https://www.who.int/publications/i/item/9789240047075',
      ],
      terms: ['prompt in-person medical examination', 'draining openings'],
    },
  ];

  for (const item of expected) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const copy = `${concern.summary} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(copy.includes(term), `${item.slug} is missing ${term}`);
  }
});

test('slow swelling with draining openings is examination-first and never product-matched', () => {
  const concern = concerns.find(item => item.slug === 'slow-swelling-drainage-pattern');
  assert.ok(concern);
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.clinicalPatternIds, ['deep-draining-mass-like']);
  assert.deepEqual(concern.productTerms, []);
  const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
  for (const term of ['usually painless', 'draining openings', 'grains', 'same-day care', 'do not cut or squeeze', 'without clinical direction']) {
    assert.ok(guidance.includes(term), `slow-swelling guide is missing ${term}`);
  }
  assert.doesNotMatch(guidance, /diagnos|you have|self-start|recommended antibiotic|recommended antifungal/i);
});

test('severe itch with nodules or sight changes is examination-first and never product-matched', () => {
  const concern = concerns.find(item => item.slug === 'severe-itch-eye-change-pattern');
  assert.ok(concern);
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.clinicalPatternIds, ['onchocerciasis-like']);
  assert.deepEqual(concern.productTerms, []);
  assert.deepEqual(concern.sources.map(source => source.url), [
    'https://www.who.int/news-room/fact-sheets/detail/onchocerciasis',
    'https://www.nhs.uk/conditions/vision-loss/',
  ]);
  const guidance = `${concern.summary} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
  for (const term of ['in-person medical and eye assessment', 'same-day care', 'sudden loss of sight', 'emergency care', 'do not start ivermectin']) {
    assert.ok(guidance.includes(term), `eye-and-skin warning guide is missing ${term}`);
  }
});

test('persistent swelling with skin changes is examination-first and never product-matched', () => {
  const concern = concerns.find(item => item.slug === 'persistent-limb-swelling-pattern');
  assert.ok(concern);
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.clinicalPatternIds, ['chronic-lymphoedema-like']);
  assert.deepEqual(concern.productTerms, []);
  assert.deepEqual(concern.sources.map(source => source.url), [
    'https://www.who.int/news-room/fact-sheets/detail/lymphatic-filariasis',
    'https://www.nhs.uk/conditions/lymphoedema/',
    'https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/',
  ]);
  const guidance = `${concern.summary} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
  for (const term of ['in-person medical review', 'same-day care', 'chest pain', 'emergency care now', 'skincare cannot establish the cause']) {
    assert.ok(guidance.includes(term), `persistent-swelling guide is missing ${term}`);
  }
});
