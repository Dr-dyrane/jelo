import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildConsultProductCandidate, buildDeterministicConsultReport, POST } from '@/app/api/consult/route';
import { products } from '@/data/catalogue';
import { assessClinicalRoutine } from './core/engine';
import { assessConsultSafety } from './safety-gate';
import type { ClinicalProductDecision } from '@/modules/recommendations/clinical-product-filter';

function request(body: unknown) {
  return new Request('http://localhost/api/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

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
  assert.equal(selfCare.allowModel, true);
  assert.equal(selfCare.allowProducts, true);
});

test('urgent and pregnancy paths return before AI and products', async () => {
  const urgentResponse = await POST(request({ query: 'A rapidly spreading painful rash with fever.', market: 'NG' }));
  const urgent = await urgentResponse.json();
  assert.equal(urgent.meta.modelCalls, 0);
  assert.equal(urgent.meta.safetyInterrupt, true);
  assert.deepEqual(urgent.products, []);
  assert.equal(urgent.timeline, undefined);

  const pregnancyResponse = await POST(request({ query: 'Acne and painful pimples on my chin.', market: 'NG', profile: { pregnant: true } }));
  const pregnancy = await pregnancyResponse.json();
  assert.equal(pregnancy.meta.modelCalls, 0);
  assert.equal(pregnancy.meta.safetyInterrupt, true);
  assert.deepEqual(pregnancy.products, []);
});

test('common emergency and urgent word orders fail closed with matching care copy', async () => {
  const cases = [
    ['I am short of breath after applying this cream.', 'emergency', /emergency care now/i],
    ["I can't swallow after using this product.", 'emergency', /emergency care now/i],
    ['My lips are swollen today.', 'urgent', /same-day/i],
    ['My eye is swollen and painful.', 'urgent', /same-day/i],
    ['My vision is suddenly blurred.', 'urgent', /same-day/i],
    ['My skin is blistering and peeling.', 'urgent', /same-day/i],
  ] as const;

  for (const [query, level, action] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assert.equal(payload.meta.modelCalls, 0, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.safetyLevel, level, query);
    assert.deepEqual(payload.products, [], query);
    assert.equal(payload.report.summary, payload.report.followUp, query);
    assert.match(payload.report.summary, action, query);
  }
});

test('a single localized blister or pustule does not overclaim a same-day emergency', async () => {
  for (const query of ['I have one small friction blister on my heel.', 'One pimple has a small amount of pus.']) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assert.equal(payload.meta.safetyInterrupt, undefined, query);
    assert.notEqual(payload.meta.safetyLevel, 'urgent', query);
    assert.notEqual(payload.meta.safetyLevel, 'emergency', query);
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
    assert.equal(payload.meta.modelCalls, 0, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.needsClarification, undefined, query);
    assert.deepEqual(payload.products, [], query);
    assert.equal(payload.report.summary, payload.clinical.referral.action, query);
    assert.equal(payload.report.followUp, payload.clinical.referral.action, query);
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
  ] as const;

  for (const [query, referralLevel] of cases) {
    const response = await POST(request({ query, market: 'NG' }));
    const payload = await response.json();
    assert.equal(payload.clinical.referral.level, referralLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
  }
});

test('pediatric prose and structured age fail closed before AI and products', async () => {
  const descriptions = [
    { query: 'My 6-year-old child has acne, whiteheads, blackheads and oily skin on the forehead.', market: 'NG' },
    { query: 'Acne, whiteheads and oily skin on the forehead.', market: 'NG', profile: { age: 6 } },
  ];

  for (const body of descriptions) {
    const response = await POST(request(body));
    const payload = await response.json();
    assert.equal(payload.meta.modelCalls, 0);
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
    assert.equal(payload.meta.modelCalls, 0);
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

test('model product candidates expose only reviewed decision fields', () => {
  const product = products.find(item => item.slug === 'cerave-foaming-facial-cleanser');
  assert.ok(product);
  const decision: ClinicalProductDecision = {
    slug: product.slug,
    eligible: true,
    careState: 'supportive_eligible',
    approvedUseIds: ['normal-oily-cleansing'],
    ingredientIds: product.verifiedIngredientIds ?? [],
    reasons: ['Cleansing for normal or oily skin'],
    exclusions: [],
    clinicalScore: 20,
  };

  const candidate = buildConsultProductCandidate(product, decision);
  assert.deepEqual(Object.keys(candidate), [
    'slug', 'brand', 'name', 'approvedUseIds', 'clinicalReasons', 'ingredientIds',
  ]);
  assert.deepEqual(candidate.approvedUseIds, decision.approvedUseIds);
  assert.deepEqual(candidate.ingredientIds, product.verifiedIngredientIds ?? []);
  for (const field of ['bestFor', 'concerns', 'skinTypes', 'usage', 'sensitiveFriendly', 'step', 'displayLine']) {
    assert.equal(field in candidate, false, field);
  }
});

test('unrecognized descriptions ask for detail instead of assuming acne', async () => {
  const response = await POST(request({ query: 'Something strange is happening.', market: 'NG' }));
  const payload = await response.json();
  assert.equal(payload.meta.modelCalls, 0);
  assert.equal(payload.meta.needsClarification, true);
  assert.deepEqual(payload.meta.concerns, []);
  assert.deepEqual(payload.products, []);
  assert.match(payload.report.summary, /location/i);
});

test('Ask Jelo keeps health details in session memory by default', async () => {
  const source = await readFile(path.join(process.cwd(), 'components/consult/consult-experience.tsx'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.match(source, /Used for this visit only/);
  assert.doesNotMatch(source, /jelocare:consult|clinical-timeline/);
  assert.match(source, /Reported signals/);
  assert.match(source, /Guidance note/);
  assert.doesNotMatch(source, /Barrier score|Clinically eligible|Safety-filtered|reviewed source/i);
});
