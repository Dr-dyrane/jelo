import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { POST } from '@/app/api/consult/route';
import { concerns } from '@/data/knowledge';
import { allowMissingConsultLimiter } from '@/lib/consult/security';
import {
  buildDeterministicConsultReport,
} from '@/modules/clinical/consult-report';
import { assessClinicalRoutine } from './core/engine';
import { assessConsultSafety, assessRedFlags } from './safety-gate';

function request(body: unknown) {
  const versionedBody = (
    typeof body === 'object'
    && body !== null
    && !Array.isArray(body)
  )
    ? { ...body, clientSchemaVersion: 2 }
    : body;
  return new Request('http://localhost/api/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(versionedBody),
  });
}

function assertPublicGuide(
  payload: {
    guide?: { slug: string; sources?: Array<{ title: string; url: string }> };
    meta: Record<string, unknown>;
  },
  patternId: string,
  message?: string,
) {
  const guide = concerns.find(concern => (
    concern.kind === 'condition-pattern'
    && concern.clinicalPatternIds.includes(patternId)
  ));
  assert.ok(guide, `${patternId} needs a public concern guide`);
  assert.equal(payload.guide?.slug, guide.slug, message);
  assert.ok(payload.guide?.sources?.every(source => (
    typeof source.title === 'string'
    && URL.canParse(source.url)
  )), message);
  assert.equal('clinical' in payload, false, message);
  assert.equal('recommendationAudit' in payload, false, message);
  assert.equal('deterministic' in payload.meta, false, message);
  assert.equal('modelCalls' in payload.meta, false, message);
}

function assertMinimalPublicContract(
  payload: {
    meta: Record<string, unknown>;
    timeline?: Record<string, unknown>;
  },
  message?: string,
) {
  assert.equal('deterministic' in payload.meta, false, message);
  assert.equal('modelCalls' in payload.meta, false, message);
  assert.equal('concerns' in payload.meta, false, message);
  assert.equal('concernSlugs' in payload.meta, false, message);
  assert.equal('clinical' in payload, false, message);
  assert.equal('recommendationAudit' in payload, false, message);
  assert.equal('timelineInsight' in payload, false, message);

  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /"(?:clinicalMatch|ruleId|ruleIds|findingIds|blockedIngredientIds|detectedIngredientIds|contraindicatedIngredientIds|clinicalScore|differentialScore|barrierScore|activeLoad|routineLoad|routineLoadDelta|optimizedRoutine|routineSummary)"\s*:/,
    message,
  );
}

function assertSafeTimeline(
  timeline: Record<string, unknown> | undefined,
  expectedConcernSlugs: readonly string[],
  message?: string,
) {
  assert.ok(timeline, message);
  assert.equal(timeline.schemaVersion, 2, message);
  assert.equal(timeline.assessmentType, 'consultation', message);
  assert.deepEqual(timeline.concernSlugs, expectedConcernSlugs, message);
  assert.equal('score' in timeline, false, message);
  assert.equal('findings' in timeline, false, message);
  assert.equal('blockedIngredientIds' in timeline, false, message);
  assert.equal('detectedIngredientIds' in timeline, false, message);
  assert.equal('concernSummary' in timeline, false, message);
  assert.equal('barrierState' in timeline, false, message);
  assert.deepEqual(Object.keys(timeline).sort(), [
    'assessmentType',
    'concernSlugs',
    'createdAt',
    'followUpAt',
    'id',
    'market',
    'recommendedProductSlugs',
    'schemaVersion',
  ], message);
}

test('stale v1 and legacy v2 timeline requests are translated without returning internals', async () => {
  const legacyV1 = {
    id: 'assessment_legacy_v1',
    schemaVersion: 1,
    createdAt: '2026-07-20T10:00:00.000Z',
    assessmentType: 'consultation',
    concernSummary: 'private-legacy-query-marker',
    concerns: ['oiliness'],
    market: 'NG',
    barrier: {
      score: 18,
      state: 'compromised',
      confidence: 'high',
      signals: ['private-barrier-marker'],
      recoveryPriority: 'high',
      recommendedRecoveryNights: 7,
    },
    activeLoad: { exfoliant: 4, retinoid: 3, antimicrobial: 2, total: 9 },
    findingRuleIds: ['private-rule-marker'],
    blockedIngredientIds: ['private-blocked-marker'],
    detectedIngredientIds: ['private-detected-marker'],
    recommendedProductSlugs: ['cerave-foaming-facial-cleanser'],
    followUpAt: '2026-07-27T10:00:00.000Z',
  };
  const legacyV2 = {
    id: 'assessment_legacy_v2',
    schemaVersion: 2,
    createdAt: '2026-07-21T10:00:00.000Z',
    assessmentType: 'consultation',
    concernSlugs: ['oily-congested-skin'],
    market: 'NG',
    barrierState: 'compromised',
    recommendedProductSlugs: ['cerave-foaming-facial-cleanser'],
    followUpAt: '2026-07-28T10:00:00.000Z',
  };
  const response = await POST(new Request('http://localhost/api/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'I need a cleanser for oily skin.',
      market: 'NG',
      priorTimeline: [legacyV1, legacyV2],
    }),
  }));
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assertSafeTimeline(payload.timeline, ['oily-congested-skin']);
  assert.deepEqual(payload.meta.concerns, []);
  assert.equal(payload.timelineInsight, undefined);
  assert.doesNotMatch(
    serialized,
    /private-|barrierState|activeLoad|blockedIngredientIds|detectedIngredientIds/,
  );
});

test('one safety decision gates products and model use', () => {
  const urgentClinical = assessClinicalRoutine('A rapidly spreading painful rash with fever.');
  const urgent = assessConsultSafety({ text: 'A rapidly spreading painful rash with fever.', profile: {}, referral: urgentClinical.referral });
  assert.equal(urgent.level, 'urgent');
  assert.equal(urgent.stopJourney, true);
  assert.equal(urgent.allowModel, false);
  assert.equal(urgent.allowProducts, false);

  const selfCareClinical = assessClinicalRoutine('Prickly bumps after sweating in hot weather.');
  const selfCare = assessConsultSafety({ text: 'Prickly bumps after sweating in hot weather.', profile: {}, referral: selfCareClinical.referral });
  assert.equal(selfCare.level, 'self-care-eligible');
  assert.equal(selfCare.stopJourney, false);
  assert.equal(selfCare.allowModel, false);
  assert.equal(selfCare.allowProducts, true);
});

test('consult rejects cross-site and oversized requests before clinical work', async () => {
  const crossSite = await POST(new Request('http://localhost/api/consult', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://attacker.example',
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify({ query: 'I need ordinary sunscreen.', market: 'NG' }),
  }));
  assert.equal(crossSite.status, 403);

  const oversized = await POST(new Request('http://localhost/api/consult', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(65 * 1024),
    },
    body: JSON.stringify({ query: 'x'.repeat(2_000), market: 'NG' }),
  }));
  assert.equal(oversized.status, 413);
});

test('consult limiter is permissive only when local configuration is absent', () => {
  assert.equal(allowMissingConsultLimiter('development'), true);
  assert.equal(allowMissingConsultLimiter('test'), true);
  assert.equal(allowMissingConsultLimiter('production'), false);
});

test('toe-web peeling does not masquerade as a widespread peeling emergency', () => {
  const toeWeb = assessRedFlags({ symptoms: ['Itchy white peeling skin is cracked between my toes.'] });
  assert.equal(toeWeb.level, 'self-care-eligible');

  const widespread = assessRedFlags({ symptoms: ['My skin is peeling across my body.'] });
  assert.equal(widespread.level, 'urgent');

  const mixed = assessRedFlags({ symptoms: ['The skin between my toes is peeling and now large areas across my body are peeling.'] });
  assert.equal(mixed.level, 'urgent');
});

test('urgent and pregnancy paths return before AI and products', async () => {
  const urgentResponse = await POST(request({ query: 'A rapidly spreading painful rash with fever.', market: 'NG' }));
  const urgent = await urgentResponse.json();
  assertMinimalPublicContract(urgent);
  assert.equal(urgent.meta.safetyInterrupt, true);
  assert.deepEqual(urgent.products, []);
  assert.equal(urgent.timeline, undefined);

  const pregnancyResponse = await POST(request({ query: 'Acne and painful pimples on my chin.', market: 'NG', profile: { pregnant: true } }));
  const pregnancy = await pregnancyResponse.json();
  assertMinimalPublicContract(pregnancy);
  assert.equal(pregnancy.meta.safetyInterrupt, true);
  assert.deepEqual(pregnancy.products, []);
});

test('common emergency and urgent word orders fail closed with matching care copy', async () => {
  const cases = [
    ['I am short of breath after applying this cream.', 'emergency', /emergency care now/i],
    ["I can't swallow after using this product.", 'emergency', /emergency care now/i],
    ['It is difficult to swallow after using this product.', 'emergency', /emergency care now/i],
    ['My lips are swollen today.', 'urgent', /same-day/i],
    ['My eye is swollen and painful.', 'urgent', /same-day/i],
    ['My vision is suddenly blurred.', 'urgent', /same-day/i],
    ['My skin is blistering and peeling.', 'urgent', /same-day/i],
  ] as const;

  for (const [query, level, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.safetyLevel, level, query);
    assert.deepEqual(payload.products, [], query);
    assert.equal(payload.report.summary, payload.report.followUp, query);
    assert.match(payload.report.summary, action, query);
  }
});

test('ordinary care reaches canonical concerns and reviewed products without a model call', async () => {
  const cases = [
    {
      query: 'I need sunscreen for every day.',
      concernSlug: 'daily-sun-protection',
      productSlugs: ['eucerin-oil-control-sun-gel-cream-spf50-50ml'],
      routinePattern: /broad-spectrum sunscreen/i,
    },
    {
      query: 'I want a deodorant for ordinary underarm odour.',
      concernSlug: 'sweat-body-odour',
      productSlugs: ['dove-go-fresh-cucumber-green-tea-spray'],
      routinePattern: /underarms/i,
    },
    {
      query: 'I need a moisturiser for dry body skin.',
      concernSlug: 'dry-rough-body-skin',
      productSlugs: [
        'aqua-rich-ceramide-body-lotion-500ml',
        'cerave-moisturising-cream-454g',
        'eucerin-urearepair-plus-10-urea-body-lotion-250ml',
        'facefacts-vitamin-c-body-lotion-400ml',
      ],
      routinePattern: /body moisturiser/i,
    },
    {
      query: 'I want shampoo and conditioner for dry frizzy hair.',
      concernSlug: 'dry-frizzy-hair',
      productSlugs: [
        'cecred-moisturizing-deep-conditioner-300ml',
        'sheamoisture-jamaican-black-castor-oil-shampoo-384ml',
        'sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml',
        'tresemme-keratin-smooth-weightless-conditioner-828ml',
      ],
      routinePattern: /conditioner/i,
    },
    {
      query: 'I need a gentle moisturiser for dry face skin.',
      concernSlug: 'dry-dehydrated-skin',
      productSlugs: [
        'cerave-pm-facial-moisturising-lotion-52ml',
        'facefacts-ceramide-moisturising-gel-cream-50ml',
      ],
      routinePattern: /reviewed moisturiser/i,
    },
    {
      query: 'I want a gentle routine for sensitive skin.',
      concernSlug: 'sensitive-barrier',
      productSlugs: [
        'cerave-pm-facial-moisturising-lotion-52ml',
        'facefacts-ceramide-moisturising-gel-cream-50ml',
        'simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
      ],
      routinePattern: /routine short/i,
    },
    {
      query: 'I need a cleanser for oily skin.',
      concernSlug: 'oily-congested-skin',
      productSlugs: [
        'cerave-foaming-facial-cleanser',
        'facefacts-ceramide-oil-control-foaming-cleanser-400ml',
      ],
      routinePattern: /without scrubbing/i,
    },
  ] as const;

  for (const expected of cases) {
    const response = await POST(request({ query: expected.query, market: 'NG' }));
    const payload = await response.json();

    assertMinimalPublicContract(payload, expected.query);
    assert.equal(payload.meta.ordinaryCare, true, expected.query);
    assert.deepEqual(payload.careIntent.concernSlugs, [expected.concernSlug], expected.query);
    assertSafeTimeline(payload.timeline, [expected.concernSlug], expected.query);
    assert.deepEqual(
      payload.products.map((product: { slug: string }) => product.slug),
      expected.productSlugs,
      expected.query,
    );
    assert.ok(payload.products.every((product: Record<string, unknown>) => (
      !('clinicalMatch' in product)
      && !('reasons' in product)
      && !('score' in product)
    )), expected.query);
    assert.match(payload.report.pattern, /everyday care, not a diagnosis/i, expected.query);
    assert.match(
      payload.report.routine.map((step: { action: string }) => step.action).join(' '),
      expected.routinePattern,
      expected.query,
    );
  }
});

test('public consult JSON never exposes internal clinical or recommendation machinery', async () => {
  const uniquePromptMarker = 'unique-prompt-marker-7b9f';
  const responses = await Promise.all([
    POST(request({ query: `I need a cleanser for oily skin. ${uniquePromptMarker}`, market: 'NG' })),
    POST(request({ query: 'I have dandruff and an itchy flaky scalp.', market: 'NG' })),
    POST(request({ query: 'A rapidly spreading painful rash with fever.', market: 'NG' })),
  ]);
  const payloads = await Promise.all(responses.map(response => response.json()));

  for (const payload of payloads) {
    assertMinimalPublicContract(payload);
    const serialized = JSON.stringify(payload);

    assert.doesNotMatch(
      serialized,
      /"(?:modelCalls|recommendationAudit|clinical|clinicalMatch|ruleId|ruleIds|findingId|findingIds|blockedIngredientIds|detectedIngredientIds|contraindicatedIngredientIds)"\s*:/,
    );
    assert.doesNotMatch(
      serialized,
      /"(?:score|clinicalScore|differentialScore|barrierScore)"\s*:\s*-?\d/,
    );
    assert.doesNotMatch(serialized, /"(?:rule|finding|evidence)_[a-z0-9_-]+"/i);
    assert.doesNotMatch(serialized, new RegExp(uniquePromptMarker, 'i'));
  }
});

test('explicit product forms never broaden into a different routine step', async () => {
  const cases = [
    {
      query: 'I need a cleansing balm for oily skin.',
      productSlugs: [
        'cerave-foaming-facial-cleanser',
        'facefacts-ceramide-oil-control-foaming-cleanser-400ml',
      ],
    },
    {
      query: 'I need a finishing oil for dry frizzy hair.',
      productSlugs: ['ogx-renewing-argan-oil-of-morocco'],
    },
    {
      query: 'I need a moisturising sunscreen for oily skin.',
      productSlugs: ['eucerin-oil-control-sun-gel-cream-spf50-50ml'],
    },
    {
      query: 'I need a moisturising body wash for dry body skin.',
      productSlugs: ['dove-skin-replenish-serum-body-wash-547ml'],
    },
    {
      query: 'I need a treatment for oily skin.',
      productSlugs: [],
    },
  ] as const;

  for (const expected of cases) {
    const response = await POST(request({ query: expected.query, market: 'NG' }));
    const payload = await response.json();

    assertMinimalPublicContract(payload, expected.query);
    assert.equal(payload.meta.ordinaryCare, true, expected.query);
    assert.deepEqual(
      payload.products.map((product: { slug: string }) => product.slug),
      expected.productSlugs,
      expected.query,
    );
  }
});

test('dandruff and itchy flaky scalp stays on its canonical scalp guide with no face products', async () => {
  const query = 'I have dandruff and an itchy flaky scalp.';
  const response = await POST(request({ query, market: 'NG' }));
  const payload = await response.json();

  assertMinimalPublicContract(payload);
  assert.equal(payload.meta.guideOnly, true);
  assert.equal(payload.guide?.slug, 'dandruff-itchy-scalp');
  assert.equal(payload.guide?.area, 'Scalp');
  assertSafeTimeline(payload.timeline, ['dandruff-itchy-scalp']);
  assert.deepEqual(payload.products, []);
  const care = payload.report.routine
    .map((step: { action: string }) => step.action)
    .join(' ');
  assert.match(care, /anti-dandruff shampoo[\s\S]*gentle cleansing[\s\S]*simple conditioning/i);
  assert.doesNotMatch(care, /face|sunscreen|moisturi[sz]er|spf/i);
});

test('heat rash and razor bumps use canonical guide care without generic product routines', async () => {
  const cases = [
    {
      query: 'I have heat rash with prickly bumps after sweating in hot weather.',
      guideSlug: 'heat-rash-pattern',
      care: /cool the skin[\s\S]*loose cotton clothing[\s\S]*avoid perfumed products/i,
    },
    {
      query: 'I have razor bumps with trapped ingrown hairs after shaving my beard line.',
      guideSlug: 'ingrown-hairs',
      care: /shave with hair growth[\s\S]*fewer razor passes[\s\S]*cool compress/i,
    },
  ] as const;

  for (const expected of cases) {
    const response = await POST(request({ query: expected.query, market: 'NG' }));
    const payload = await response.json();
    const care = payload.report.routine
      .map((step: { action: string }) => step.action)
      .join(' ');

    assertMinimalPublicContract(payload, expected.query);
    assert.equal(payload.meta.guideOnly, true, expected.query);
    assert.equal(payload.guide?.slug, expected.guideSlug, expected.query);
    assertSafeTimeline(payload.timeline, [expected.guideSlug], expected.query);
    assert.deepEqual(payload.products, [], expected.query);
    assert.match(care, expected.care, expected.query);
    assert.doesNotMatch(care, /generic cleanser|moisturi[sz]er|spf/i, expected.query);
  }
});

test('oral and prescribed medicine language never becomes a topical application instruction', async () => {
  for (const query of [
    'I take tranexamic acid tablets for dark marks.',
    'I am taking tranexamic acid capsules.',
    'My doctor prescribed tranexamic acid medicine.',
    'I use tranexamic acid for heavy periods.',
    'What dose of tranexamic acid should I use?',
  ]) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    const rendered = JSON.stringify(payload.report);

    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.doesNotMatch(rendered, /apply tranexamic acid/i, query);
    assert.match(payload.report.summary, /do not apply, stop or change/i, query);
  }
});

test('ordinary-looking acne and dark-spot differentials remain deterministic guide-only paths', async () => {
  const cases = [
    ['Acne, whiteheads and oily skin on my forehead.', 'acne-breakouts'],
    ['Flat dark marks remained after acne on my cheeks.', 'dark-spots'],
  ] as const;

  for (const [query, guideSlug] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();

    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.guideOnly, true, query);
    assert.equal(payload.guide?.slug, guideSlug, query);
    assertSafeTimeline(payload.timeline, [guideSlug], query);
    assert.deepEqual(payload.products, [], query);
  }
});

test('red flags and directed care paths interrupt nearby ordinary-care requests', async () => {
  const cases = [
    {
      query: 'I want a deodorant because my night sweats soak the bedding.',
      patternId: 'hyperhidrosis-like',
    },
    {
      query: 'I want conditioner for dry frizzy hair, but I have a smooth bald patch.',
      patternId: 'alopecia-areata-like',
    },
    {
      query: 'I need daily sunscreen for a changing bleeding mole.',
      patternId: undefined,
    },
    {
      query: 'I need body lotion because a painful rash is rapidly spreading and I have a fever.',
      patternId: undefined,
    },
  ] as const;

  for (const expected of cases) {
    const response = await POST(request({ query: expected.query, market: 'NG' }));
    const payload = await response.json();

    assertMinimalPublicContract(payload, expected.query);
    assert.equal(payload.meta.safetyInterrupt, true, expected.query);
    assert.equal(payload.meta.ordinaryCare, undefined, expected.query);
    assert.equal(payload.careIntent, undefined, expected.query);
    assert.deepEqual(payload.products, [], expected.query);
    if (expected.patternId) {
      assertPublicGuide(payload, expected.patternId, expected.query);
    }
  }
});

test('unresolved symptoms beside product words do not enter the ordinary-care bridge', async () => {
  for (const query of [
    'I need body lotion for a rash.',
    'I want conditioner because my scalp is painful.',
    'I need body cream because my skin is itchy.',
    'I need deodorant because I suddenly smell different.',
  ]) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();

    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.ordinaryCare, undefined, query);
    assert.equal(payload.careIntent, undefined, query);
    assert.deepEqual(payload.products, [], query);
  }
});

test('a single localized blister or pustule does not overclaim a same-day emergency', async () => {
  for (const query of ['I have one small friction blister on my heel.', 'One pimple has a small amount of pus.']) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.safetyInterrupt, undefined, query);
    assert.notEqual(payload.meta.safetyLevel, 'urgent', query);
    assert.notEqual(payload.meta.safetyLevel, 'emergency', query);
  }
});

test('a mild medicine-linked rash stops product guidance without overclaiming an emergency', async () => {
  const query = 'A mild rash after starting a new medicine. No blisters and no peeling.';
  const response = await POST(request({ query, market: 'NG' }));
  const payload = await response.json();
  assertPublicGuide(payload, 'severe-medicine-reaction-like');
  assert.equal(payload.meta.safetyLevel, 'clinician-review');
  assert.deepEqual(payload.products, []);
});

test('published guide-parity patterns stop model and product guidance with deterministic care', async () => {
  const cases = [
    {
      query: 'My skin is painful, hot and swollen with a spreading colour change.',
      patternId: 'cellulitis-like',
      safetyLevel: 'urgent',
      action: /same-day/i,
    },
    {
      query: 'Sores burst and left spreading golden-brown crusts around my mouth.',
      patternId: 'impetigo-like',
      safetyLevel: 'clinician-review',
      action: /pharmacist or clinician/i,
    },
    {
      query: 'Tingling followed by painful blisters in a band on one side of my face.',
      patternId: 'shingles-like',
      safetyLevel: 'clinician-review',
      action: /within 3 days/i,
    },
    {
      query: 'A lighter patch has reduced feeling and numbness in the patch.',
      patternId: 'numb-patch-like',
      safetyLevel: 'clinician-review',
      action: /in-person examination/i,
    },
    {
      query: 'Dark, thickened velvety skin on my neck does not scrub away.',
      patternId: 'velvety-thickening-like',
      safetyLevel: 'clinician-review',
      action: /medical review/i,
    },
    {
      query: 'A scaly scalp patch has broken hairs, black dots and patchy hair loss.',
      patternId: 'tinea-capitis-like',
      safetyLevel: 'clinician-review',
      action: /prescription treatment/i,
    },
    {
      query: 'A firm raised scar grew beyond the edge of my old piercing.',
      patternId: 'keloid-scar-like',
      safetyLevel: 'clinician-review',
      action: /examination before choosing scar treatment/i,
    },
    {
      query: 'Firm painful lesions are blistering and I have swollen lymph nodes after close contact with mpox.',
      patternId: 'mpox-like',
      safetyLevel: 'urgent',
      action: /same-day/i,
    },
    {
      query: 'A spreading target-like rash appeared after starting a new medicine.',
      patternId: 'severe-medicine-reaction-like',
      safetyLevel: 'emergency',
      action: /emergency hospital care now/i,
    },
    {
      query: 'A painless swelling on my arm turned into an ulcer and keeps enlarging without fever.',
      patternId: 'painless-ulcer-like',
      safetyLevel: 'clinician-review',
      action: /in-person medical examination/i,
    },
    {
      query: 'Severe itching with lumps under my skin and my vision is getting worse.',
      patternId: 'onchocerciasis-like',
      safetyLevel: 'urgent',
      action: /same-day/i,
    },
    {
      query: 'My leg has stayed swollen for months and the skin is becoming thick and hard.',
      patternId: 'chronic-lymphoedema-like',
      safetyLevel: 'clinician-review',
      action: /in-person medical assessment/i,
    },
    {
      query: 'A child has a wart-like growth on the leg that became an ulcer.',
      patternId: 'infectious-papilloma-ulcer-like',
      safetyLevel: 'clinician-review',
      action: /prompt in-person examination/i,
    },
    {
      query: 'A painless foot mass has several draining holes with black grains.',
      patternId: 'deep-draining-mass-like',
      safetyLevel: 'clinician-review',
      action: /prompt in-person medical examination/i,
    },
    {
      query: 'A child has swollen gums and facial swelling that is getting worse quickly.',
      patternId: 'rapid-mouth-face-breakdown-like',
      safetyLevel: 'urgent',
      action: /urgent in-person medical assessment today/i,
    },
    {
      query: 'Sudden itchy same-size bumps centred on hairs after sweating in tight clothing.',
      patternId: 'folliculitis',
      safetyLevel: 'clinician-review',
      action: /in-person skin review/i,
    },
    {
      query: 'A hard painful lump has a soft centre and is leaking pus.',
      patternId: 'boil-abscess-like',
      safetyLevel: 'clinician-review',
      action: /in-person medical examination/i,
    },
    {
      query: 'I used an unlabelled bleaching cream and the label mentions mercury.',
      patternId: 'skin-lightening-exposure-like',
      safetyLevel: 'clinician-review',
      action: /prompt medical or poison-service advice/i,
    },
    {
      query: 'Many small acne-like bumps around my mouth burn and flake after hydrocortisone on my face.',
      patternId: 'periorificial-dermatitis-like',
      safetyLevel: 'clinician-review',
      action: /in-person skin examination/i,
    },
    {
      query: 'Raised itchy patches appear and disappear within hours and move around my body.',
      patternId: 'urticaria-like',
      safetyLevel: 'clinician-review',
      action: /pharmacist or clinician/i,
    },
    {
      query: 'Tingling came before small fluid-filled blisters on my lip that crusted into a scab.',
      patternId: 'cold-sore-like',
      safetyLevel: 'clinician-review',
      action: /pharmacist or clinician/i,
    },
    {
      query: 'Itchy white peeling skin is cracked between my toes.',
      patternId: 'tinea-pedis-like',
      safetyLevel: 'clinician-review',
      action: /pharmacist or clinician/i,
    },
    {
      query: 'My thick yellow toenail is crumbly and lifting.',
      patternId: 'nail-change-like',
      safetyLevel: 'clinician-review',
      action: /pharmacist or clinician/i,
    },
    {
      query: 'A mole is changing and bleeding.',
      patternId: 'changing-skin-mark-like',
      safetyLevel: 'clinician-review',
      action: /prompt in-person skin examination/i,
    },
  ] as const;

  for (const expected of cases) {
    const response = await POST(request({ query: expected.query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, expected.patternId, expected.query);
    assert.equal(payload.meta.safetyInterrupt, true, expected.query);
    assert.equal(payload.meta.safetyLevel, expected.safetyLevel, expected.query);
    assert.deepEqual(payload.products, [], expected.query);
    assert.match(payload.report.summary, expected.action, expected.query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, expected.query);
  }
});

test('serious expanded patterns surface their deterministic referral before clarification', async () => {
  const descriptions = [
    'Recurring deep lumps in my armpits with drainage, tunnels and repeated scars.',
    'Smooth milky white patches with loss of skin colour and no scale.',
    'Thick plaques with silvery scale on my elbows and nail pits.',
    'An itchy ring-shaped patch with a raised spreading edge and central clearing.',
    'Hair loss spreading from the crown with burning and tenderness; the scalp looks smooth and shiny.',
    'Itchy firm bumps and raised scars on the back of my neck after a close haircut.',
    'Lighter fine scaly patches on my chest that recur in hot humid weather.',
    'Severe itching at night between my fingers and wrists, and other people at home are itchy.',
    'A dark line under my toenail is growing wider.',
    'A dark spot is changing shape and bleeding.',
    'A sore on my foot keeps healing and returning.',
  ];

  for (const query of descriptions) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertMinimalPublicContract(payload, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.needsClarification, undefined, query);
    assert.ok(['clinician-review', 'urgent', 'emergency'].includes(payload.meta.safetyLevel), query);
    assert.deepEqual(payload.products, [], query);
    assert.equal(payload.report.summary, payload.report.followUp, query);
    assert.match(payload.report.summary, /pharmacist|clinician|medical|care|examination|assessment/i, query);
  }
});

test('named conditions stop model and product use even beside product-eligible acne', async () => {
  const cases = [
    ['I was diagnosed with scabies and have oily acne on my forehead.', 'pharmacist'],
    ['I have tinea versicolor and oily acne pimples.', 'pharmacist'],
    ['I have CCCA and oily acne pimples.', 'dermatology'],
    ['I have central centrifugal cicatricial alopecia and oily acne.', 'dermatology'],
    ['I have AKN plus oily acne.', 'dermatology'],
    ['I have acne keloidalis nuchae plus oily acne.', 'dermatology'],
    ['I have tinea capitis plus oily acne.', 'primary-care'],
    ['I have a keloid scar plus oily acne.', 'dermatology'],
    ['I may have mpox plus oily acne.', 'primary-care'],
    ['I was told this could be Buruli ulcer and I also have oily acne.', 'primary-care'],
    ['I was told this could be river blindness and I also have oily acne.', 'primary-care'],
    ['I have lymphoedema and oily acne on my forehead.', 'primary-care'],
    ['I was told this could be yaws and I also have oily acne.', 'primary-care'],
    ['I was told this could be mycetoma and I also have oily acne.', 'primary-care'],
    ['I was told this could be noma and I also have oily acne.', 'urgent'],
    ['I have folliculitis and oily acne.', 'primary-care'],
    ['I have a boil and oily acne.', 'primary-care'],
    ['I used a bleaching cream and also have oily acne.', 'primary-care'],
    ['I have perioral dermatitis and oily acne.', 'dermatology'],
    ['I have hives and oily acne.', 'pharmacist'],
    ['I have a cold sore and oily acne.', 'pharmacist'],
  ] as const;

  for (const [query, referralLevel] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertMinimalPublicContract(payload, query);
    assert.equal(
      payload.meta.safetyLevel,
      referralLevel === 'urgent' ? 'urgent' : 'clinician-review',
      query,
    );
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.match(
      payload.report.summary,
      /pharmacist|clinician|medical|urgent|in-person|health service|testing advice/i,
      query,
    );
  }
});

test('a boil on the face stops model and products for same-day assessment', async () => {
  const response = await POST(request({ query: 'I have a painful boil on my face with a soft centre.', market: 'NG' }));
  const payload = await response.json();
  assertPublicGuide(payload, 'boil-abscess-like');
  assert.equal(payload.meta.safetyLevel, 'urgent');
  assert.equal(payload.meta.safetyInterrupt, true);
  assert.deepEqual(payload.products, []);
  assert.match(payload.report.summary, /same-day in-person medical assessment/i);
});

test('new look-alike patterns fail closed at higher-risk boundaries', async () => {
  const cases = [
    ['I have hives with swelling under my skin on my hands.', 'urticaria-like', 'urgent', /same-day/i],
    ['My hives rash is spreading and I feel unwell.', 'urticaria-like', 'urgent', /same-day/i],
    ['I have hives and my lips and mouth are suddenly swollen.', 'urticaria-like', 'emergency', /emergency care now/i],
    ['I have hives and my tongue is swollen and I am struggling to breathe.', 'urticaria-like', 'emergency', /emergency care now/i],
    ['I have a cold sore with blisters near my eye.', 'cold-sore-like', 'urgent', /same-day/i],
    ['I have an active cold sore and kissed my newborn.', 'cold-sore-like', 'urgent', /same-day/i],
  ] as const;

  for (const [query, patternId, safetyLevel, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.match(payload.report.summary, action, query);
  }
});

test('excessive or night sweating routes to cause-finding without products', async () => {
  const response = await POST(request({
    query: 'Night sweats keep soaking my sheets even when the room is cool.',
    market: 'NG',
  }));
  const payload = await response.json();
  assertPublicGuide(payload, 'hyperhidrosis-like');
  assert.equal(payload.meta.safetyLevel, 'clinician-review');
  assert.equal(payload.meta.safetyInterrupt, true);
  assert.deepEqual(payload.products, []);
  assert.match(payload.report.summary, /look for a cause/i);
  assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i);
});

test('diabetes-related foot changes never reach AI or product guidance', async () => {
  const cases = [
    ['I have diabetes and a new wound on my foot.', 'urgent', /urgent in-person foot assessment today/i],
    ['I have diabetes and a foot ulcer with fever.', 'emergency', /emergency hospital care now/i],
  ] as const;

  for (const [query, safetyLevel, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, 'diabetes-foot-warning-like', query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.match(payload.report.summary, action, query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, query);
  }
});

test('chemical, jaundice and genital warning patterns never reach AI or products', async () => {
  const cases = [
    [
      'Bleach splashed on my arm and my skin is burning.',
      'chemical-burn-exposure-like',
      'emergency',
      /rinse[\s\S]*running water[\s\S]*hospital/i,
    ],
    [
      'The whites of my eyes look yellow and my skin looks yellow.',
      'jaundice-warning-like',
      'urgent',
      /urgent medical assessment today[\s\S]*whites of the eyes/i,
    ],
    [
      'I have a genital sore and unusual discharge.',
      'genital-symptom-warning-like',
      'clinician-review',
      /confidential[\s\S]*assessment and testing/i,
    ],
  ] as const;

  for (const [query, patternId, safetyLevel, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.match(payload.report.summary, action, query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, query);
  }
});

test('fever-and-rash warning patterns never reach AI or product guidance', async () => {
  const cases = [
    [
      'A purple rash does not fade when pressed and I have a fever and stiff neck.',
      'meningitis-sepsis-warning-like',
      'emergency',
      /emergency hospital care now/i,
    ],
    [
      'My rash does not disappear when I press a glass on it.',
      'meningitis-sepsis-warning-like',
      'emergency',
      /emergency hospital care now/i,
    ],
    [
      'High fever, cough, runny nose and red watery eyes came before a rash that started on my face and spread down.',
      'measles-rash-warning-like',
      'urgent',
      /call the health facility before arriving/i,
    ],
  ] as const;

  for (const [query, patternId, safetyLevel, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
    assert.match(payload.report.summary, action, query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, query);
  }
});

test('rapid mouth-to-face warning signs never reach AI or products', async () => {
  const cases = [
    ['A gum sore is spreading into the cheek and the mouth tissue is turning dark.', 'urgent'],
    ['A gum sore is spreading into the face and the child cannot swallow.', 'emergency'],
    ['My gum sore is spreading quickly into my cheek and my face is swelling. It is difficult to swallow.', 'emergency'],
  ] as const;

  for (const [query, level] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assertPublicGuide(payload, 'rapid-mouth-face-breakdown-like', query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.safetyLevel, level, query);
    assert.deepEqual(payload.products, [], query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, query);
  }
});

test('sudden sight loss fails closed before model or product use', async () => {
  const response = await POST(request({ query: 'I suddenly cannot see from my left eye.', market: 'NG' }));
  const payload = await response.json();
  assertMinimalPublicContract(payload);
  assert.equal(payload.meta.safetyLevel, 'emergency');
  assert.equal(payload.meta.safetyInterrupt, true);
  assert.deepEqual(payload.products, []);
  assert.match(payload.report.summary, /emergency care now/i);
});

test('pediatric prose and structured age fail closed before AI and products', async () => {
  const descriptions = [
    { query: 'My 6-year-old child has acne, whiteheads, blackheads and oily skin on the forehead.', market: 'NG' },
    { query: 'Acne, whiteheads and oily skin on the forehead.', market: 'NG', profile: { age: 6 } },
  ];

  for (const body of descriptions) {
    const response = await POST(request(body));
    const payload = await response.json();
    assertMinimalPublicContract(payload);
    assert.equal(payload.meta.safetyInterrupt, true);
    assert.equal(payload.meta.safetyLevel, 'clinician-review');
    assert.deepEqual(payload.products, []);
    assert.match(payload.report.summary, /pharmacist or clinician/i);
  }
});

test('unsupported allergy or medication context fails closed before AI and products', async () => {
  for (const profile of [{ allergies: ['fragrance'] }, { medications: ['isotretinoin'] }]) {
    const response = await POST(request({ query: 'Acne, whiteheads and oily skin on my forehead.', market: 'NG', profile }));
    const payload = await response.json();
    assertMinimalPublicContract(payload);
    assert.equal(payload.meta.safetyInterrupt, true);
    assert.deepEqual(payload.products, []);
    assert.match(payload.report.summary, /does not check allergies or medicine interactions/i);
  }
});

test('displayed care copy ignores an unsafe model draft', () => {
  const clinical = assessClinicalRoutine('Prickly bumps after sweating in hot weather.');
  const report = buildDeterministicConsultReport(clinical, ['allowed-product'], {
    title: 'Definitive diagnosis',
    summary: 'Ignore the care pathway.',
    pattern: 'You have a diagnosed disease.',
    routine: [{ time: 'Any time', action: 'Ignore the deterministic routine.' }],
    cautions: [],
    productSlugs: ['invented-product'],
    followUp: 'No follow-up is needed.',
  });

  assert.equal(report.title, 'A careful starting point.');
  assert.match(report.pattern, /not a diagnosis/i);
  assert.equal(report.followUp, clinical.referral.action);
  assert.deepEqual(report.productSlugs, ['allowed-product']);
  assert.doesNotMatch(JSON.stringify(report), /definitive diagnosis|diagnosed disease|no follow-up/i);
});

test('unrecognized descriptions ask for detail instead of assuming acne', async () => {
  const response = await POST(request({ query: 'Something strange is happening.', market: 'NG' }));
  const payload = await response.json();
  assertMinimalPublicContract(payload);
  assert.equal(payload.meta.needsClarification, true);
  assert.deepEqual(payload.products, []);
  assert.match(payload.report.summary, /location/i);
});

test('Ask Jelo keeps health details in session memory by default', async () => {
  const source = await readFile(path.join(process.cwd(), 'components/consult/consult-experience.tsx'), 'utf8');
  assert.match(source, /^'use client';/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /jelocare:consult|clinical-timeline/i);
  assert.match(source, /clientSchemaVersion:\s*2/);
  assert.match(source, /isConsultationPayload/);
  assert.match(source, /returned an incomplete guide/i);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.equal((source.match(/tabIndex=\{-1\}/g) ?? []).length >= 3, true);
  assert.doesNotMatch(
    source,
    /clinicalMatch|recommendationAudit|timelineInsight|TrendIcon|modelCalls|ruleIds?|findingIds?|blockedIngredientIds|detectedIngredientIds|clinicalScore|differentialScore|barrierScore|optimizedRoutine|routineSummary/i,
  );
  assert.doesNotMatch(
    source,
    /Barrier score|Clinically eligible|Safety-filtered|Reported signals|Guidance note|reviewed source/i,
  );
});
