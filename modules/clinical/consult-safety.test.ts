import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildConsultProductCandidate, buildDeterministicConsultReport, POST } from '@/app/api/consult/route';
import { products } from '@/data/catalogue';
import { assessClinicalRoutine } from './core/engine';
import { assessConsultSafety, assessRedFlags } from './safety-gate';
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
    ['It is difficult to swallow after using this product.', 'emergency', /emergency care now/i],
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

test('a mild medicine-linked rash stops product guidance without overclaiming an emergency', async () => {
  const query = 'A mild rash after starting a new medicine. No blisters and no peeling.';
  const response = await POST(request({ query, market: 'NG' }));
  const payload = await response.json();
  assert.equal(payload.clinical.differential.primary?.id, 'severe-medicine-reaction-like');
  assert.equal(payload.clinical.referral.level, 'primary-care');
  assert.equal(payload.meta.safetyLevel, 'clinician-review');
  assert.equal(payload.meta.modelCalls, 0);
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
    assert.equal(payload.clinical.differential.primary?.id, expected.patternId, expected.query);
    assert.equal(payload.meta.modelCalls, 0, expected.query);
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
    assert.equal(payload.clinical.referral.level, referralLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.deepEqual(payload.products, [], query);
  }
});

test('a boil on the face stops model and products for same-day assessment', async () => {
  const response = await POST(request({ query: 'I have a painful boil on my face with a soft centre.', market: 'NG' }));
  const payload = await response.json();
  assert.equal(payload.clinical.differential.primary?.id, 'boil-abscess-like');
  assert.equal(payload.clinical.referral.level, 'urgent');
  assert.equal(payload.meta.safetyLevel, 'urgent');
  assert.equal(payload.meta.modelCalls, 0);
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
    assert.equal(payload.clinical.differential.primary?.id, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
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
  assert.equal(payload.clinical.differential.primary?.id, 'hyperhidrosis-like');
  assert.equal(payload.clinical.referral.level, 'primary-care');
  assert.equal(payload.meta.safetyLevel, 'clinician-review');
  assert.equal(payload.meta.modelCalls, 0);
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
    assert.equal(payload.clinical.differential.primary?.id, 'diabetes-foot-warning-like', query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
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
    assert.equal(payload.clinical.differential.primary?.id, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
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
    assert.equal(payload.clinical.differential.primary?.id, patternId, query);
    assert.equal(payload.meta.safetyLevel, safetyLevel, query);
    assert.equal(payload.meta.modelCalls, 0, query);
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
    assert.equal(payload.clinical.differential.primary?.id, 'rapid-mouth-face-breakdown-like', query);
    assert.equal(payload.meta.modelCalls, 0, query);
    assert.equal(payload.meta.safetyInterrupt, true, query);
    assert.equal(payload.meta.safetyLevel, level, query);
    assert.deepEqual(payload.products, [], query);
    assert.doesNotMatch(payload.report.pattern, /you have|diagnos/i, query);
  }
});

test('sudden sight loss fails closed before model or product use', async () => {
  const response = await POST(request({ query: 'I suddenly cannot see from my left eye.', market: 'NG' }));
  const payload = await response.json();
  assert.equal(payload.clinical.referral.level, 'emergency');
  assert.equal(payload.clinical.referral.urgency, 'immediate');
  assert.equal(payload.meta.safetyLevel, 'emergency');
  assert.equal(payload.meta.modelCalls, 0);
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
