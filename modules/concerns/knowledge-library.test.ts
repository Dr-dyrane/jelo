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
        url.hostname === 'www.aad.org'
          || url.hostname === 'www.nhs.uk'
          || url.hostname === 'www.england.nhs.uk'
          || url.hostname === 'www.nice.org.uk'
          || url.hostname === 'www.who.int'
          || url.hostname === 'www.ncdc.gov.ng'
          || url.hostname === 'nafdac.gov.ng'
          || url.hostname === 'www.nafdac.gov.ng',
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

test('sweat guidance separates everyday care from excessive or night sweating', () => {
  const everyday = concerns.find(item => item.slug === 'sweat-body-odour');
  assert.ok(everyday);
  assert.equal(everyday.kind, 'concern');
  assert.ok(everyday.productTerms.includes('deodorant'));
  assert.ok(everyday.productTerms.includes('antiperspirant'));
  assert.match(everyday.ingredients.join(' '), /deodorant for odour/i);
  assert.match(everyday.ingredients.join(' '), /antiperspirant for sweat/i);

  const excessive = concerns.find(item => item.slug === 'excessive-sweating-pattern');
  assert.ok(excessive);
  assert.equal(excessive.kind, 'condition-pattern');
  assert.deepEqual(excessive.clinicalPatternIds, ['hyperhidrosis-like']);
  assert.deepEqual(excessive.productTerms, []);
  assert.match(excessive.escalation, /night sweats/i);
  assert.match(excessive.escalation, /unexplained weight loss/i);
  assert.match(excessive.escalation, /do not stop a prescribed medicine/i);
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

test('rapid gum-to-face changes are urgent, non-diagnostic and never product-matched', () => {
  const concern = concerns.find(item => item.slug === 'rapid-gum-face-change-pattern');
  assert.ok(concern);
  assert.equal(concern.kind, 'condition-pattern');
  assert.deepEqual(concern.clinicalPatternIds, ['rapid-mouth-face-breakdown-like']);
  assert.deepEqual(concern.productTerms, []);
  assert.deepEqual(concern.sources.map(source => source.url), [
    'https://www.who.int/news-room/fact-sheets/detail/noma/',
  ]);
  const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
  for (const term of ['same-day medical care', 'dark', 'breaking-down tissue', 'difficulty eating', 'emergency care now', 'do not wait for skincare']) {
    assert.ok(guidance.includes(term), `rapid gum-to-face guide is missing ${term}`);
  }
  assert.doesNotMatch(guidance, /you have|diagnos|antibiotic|mouthwash treatment|isolate/i);
});

test('cosmetic-looking safety guides are sourced, examination-first and product-ineligible', () => {
  const expected = [
    {
      slug: 'folliculitis-pattern',
      pattern: 'folliculitis',
      sources: ['https://www.aad.org/public/diseases/a-z/folliculitis'],
      terms: ['look like acne', 'in-person skin review', 'same-day care', 'do not self-start antibiotics'],
    },
    {
      slug: 'boil-abscess-pattern',
      pattern: 'boil-abscess-like',
      sources: [
        'https://www.nhs.uk/conditions/boils/',
        'https://www.nhs.uk/conditions/skin-abscess/',
      ],
      terms: ['painful lump', 'do not pick, squeeze or pierce', 'same-day care', 'diabetes', 'more than 2 weeks'],
    },
    {
      slug: 'skin-lightening-exposure-pattern',
      pattern: 'skin-lightening-exposure-like',
      sources: [
        'https://www.who.int/publications/i/item/WHO-CED-PHE-EPE-19.13',
        'https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulations/All_Regulations/Cosmetics-Products-Prohibition-of-Bleaching-Agents-Regulations-2019.pdf',
        'https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Poison_Control/Mercury-Poisoning-in-Skin-Lightening-Products-SLPS-and-Clinical-Management-of-Chronic-Mercury-Intoxication.pdf',
      ],
      terms: ['mercury-containing', 'ingredient list', 'poison-service assessment', 'pregnancy', 'emergency care'],
    },
  ];

  for (const item of expected) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(guidance.includes(term), `${item.slug} is missing ${term}`);
    assert.doesNotMatch(guidance, /you have|diagnos|recommended product|buy now/i);
  }
});

test('common cosmetic look-alikes remain observable, sourced and product-ineligible', () => {
  const expected = [
    {
      slug: 'mouth-area-bumps-pattern',
      pattern: 'periorificial-dermatitis-like',
      sources: ['https://www.aad.org/public/diseases/a-z/perioral-dermatitis'],
      terms: ['different plan from acne', 'in-person skin examination', 'prescribed steroid', 'same-day medical assessment'],
    },
    {
      slug: 'raised-itchy-welts-pattern',
      pattern: 'urticaria-like',
      sources: [
        'https://www.nhs.uk/conditions/hives/',
        'https://www.nhs.uk/conditions/angioedema/',
      ],
      terms: ['skin-coloured', 'swelling under the skin', 'emergency care now', 'do not guess a medicine trigger'],
    },
    {
      slug: 'tingling-facial-blisters-pattern',
      pattern: 'cold-sore-like',
      sources: [
        'https://www.nhs.uk/conditions/cold-sores/',
        'https://www.aad.org/public/diseases/a-z/cold-sores-treatment',
        'https://www.aad.org/public/diseases/a-z/herpes-simplex-symptoms',
      ],
      terms: ['contagious until fully healed', 'same-day assessment', 'never kiss a newborn', 'outer lip or face'],
    },
  ];

  for (const item of expected) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(guidance.includes(term), `${item.slug} is missing ${term}`);
    assert.doesNotMatch(guidance, /you have|diagnos|recommended product|buy now/i);
  }
});

test('sun prevention is ordinary while new stop-journey guides remain product-ineligible', () => {
  const sun = concerns.find(item => item.slug === 'daily-sun-protection');
  assert.ok(sun);
  assert.equal(sun.kind, 'concern');
  assert.equal(sun.area, 'Face');
  assert.deepEqual(sun.sources.map(source => source.url), [
    'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen',
  ]);
  const sunGuidance = `${sun.summary} ${sun.signals.join(' ')} ${sun.ingredients.join(' ')} ${sun.escalation}`.toLowerCase();
  for (const term of ['broad-spectrum', 'spf 30 or higher', 'shade', 'protective clothing', 'reapplication']) {
    assert.ok(sunGuidance.includes(term), `daily sun protection is missing ${term}`);
  }

  const warnings = [
    {
      slug: 'product-chemical-burn-pattern',
      pattern: 'chemical-burn-exposure-like',
      sources: ['https://www.nhs.uk/conditions/acid-and-chemical-burns/'],
      terms: ['emergency services', 'brush dry chemical', 'cool or lukewarm running water', 'go to hospital'],
    },
    {
      slug: 'yellow-skin-or-eyes-pattern',
      pattern: 'jaundice-warning-like',
      sources: ['https://www.nhs.uk/conditions/jaundice/'],
      terms: ['urgent medical assessment today', 'whites of the eyes', 'brown or black skin', 'several possible causes'],
    },
    {
      slug: 'genital-sore-discharge-pattern',
      pattern: 'genital-symptom-warning-like',
      sources: [
        'https://www.who.int/health-topics/sexually-transmitted-infections',
        'https://www.nhs.uk/conditions/sexually-transmitted-infections-stis/',
      ],
      terms: ['confidential sexual-health', 'testing', 'symptoms alone cannot identify', 'same-day urgent care'],
    },
  ];

  for (const item of warnings) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(guidance.includes(term), `${item.slug} is missing ${term}`);
    assert.doesNotMatch(guidance, /you have|diagnos|recommended product|buy now/i);
  }
});

test('fever-and-rash safety guides are sourced, non-diagnostic and product-ineligible', () => {
  const expected = [
    {
      slug: 'fever-non-fading-rash-pattern',
      pattern: 'meningitis-sepsis-warning-like',
      sources: [
        'https://www.ncdc.gov.ng/news/535/3rd-march-2026-%7C-public-health-advisory-on-cerebrospinal-meningitis-%28csm%29',
        'https://www.who.int/news-room/fact-sheets/detail/meningitis',
        'https://www.nhs.uk/conditions/meningitis/',
      ],
      terms: ['do not fade when pressed', 'emergency hospital care now', 'harder to see on brown or black skin', 'do not wait for a rash'],
    },
    {
      slug: 'fever-spreading-rash-pattern',
      pattern: 'measles-rash-warning-like',
      sources: [
        'https://www.who.int/news-room/fact-sheets/detail/measles',
        'https://www.nhs.uk/conditions/measles/',
        'https://www.ncdc.gov.ng/themes/common/files/sitreps/e6d703892b7d429fffc731ea539d1fed.pdf',
      ],
      terms: ['cough or a runny nose', 'face or neck and spreading down', 'call before arriving', 'self-start vitamin a or antibiotics'],
    },
  ];

  for (const item of expected) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(guidance.includes(term), `${item.slug} is missing ${term}`);
    assert.doesNotMatch(guidance, /you have|diagnos|recommended product|buy now/i);
  }
});

test('foot, nail and changing-mark guides are sourced, non-diagnostic and product-ineligible', () => {
  const expected = [
    {
      slug: 'athletes-foot-pattern',
      pattern: 'tinea-pedis-like',
      sources: ['https://www.nhs.uk/conditions/athletes-foot/'],
      terms: ['between the toes', 'clean and dry', 'diabetes', 'same-day care'],
    },
    {
      slug: 'diabetes-foot-change-pattern',
      pattern: 'diabetes-foot-warning-like',
      sources: [
        'https://www.who.int/news-room/fact-sheets/detail/diabetes',
        'https://www.nice.org.uk/guidance/ng19/chapter/Recommendations',
        'https://www.england.nhs.uk/north/wp-content/uploads/sites/5/2018/12/Looking-after-your-Diabetic-Foot-Ulcer.pdf',
      ],
      terms: ['new foot wound', 'urgent in-person assessment today', 'even if it does not hurt', 'emergency hospital care now', 'corn or wart acids'],
    },
    {
      slug: 'thick-discoloured-nail-pattern',
      pattern: 'nail-change-like',
      sources: [
        'https://www.nhs.uk/conditions/Fungal-nail-infection/',
        'https://www.aad.org/public/diseases/a-z/nail-fungus-symptoms',
      ],
      terms: ['thicker', 'crumbly', 'dark band', 'in-person skin examination'],
    },
    {
      slug: 'changing-skin-mark-pattern',
      pattern: 'changing-skin-mark-like',
      sources: [
        'https://www.aad.org/public/diseases/skin-cancer/find/skin-of-color',
        'https://www.aad.org/public/diseases/skin-cancer/find/know-how',
      ],
      terms: ['changes', 'does not heal', 'palms, soles, nails', 'in-person skin examination'],
    },
  ];

  for (const item of expected) {
    const concern = concerns.find(candidate => candidate.slug === item.slug);
    assert.ok(concern, item.slug);
    assert.equal(concern.kind, 'condition-pattern');
    assert.deepEqual(concern.clinicalPatternIds, [item.pattern]);
    assert.deepEqual(concern.productTerms, []);
    assert.deepEqual(concern.sources.map(source => source.url), item.sources);
    const guidance = `${concern.summary} ${concern.signals.join(' ')} ${concern.ingredients.join(' ')} ${concern.escalation}`.toLowerCase();
    for (const term of item.terms) assert.ok(guidance.includes(term), `${item.slug} is missing ${term}`);
    assert.doesNotMatch(guidance, /you have|diagnos|recommended product|buy now/i);
  }
});
