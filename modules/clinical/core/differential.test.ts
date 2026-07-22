import assert from 'node:assert/strict';
import test from 'node:test';
import { assessClinicalRoutine } from './engine';

const patternCases = [
  ['Very itchy dry patches that recur in my elbow folds.', 'atopic-dermatitis-like'],
  ['A very itchy rash with blisters exactly where my hair dye touched.', 'allergic-contact-dermatitis-like'],
  ['Thick plaques with silvery scale on my elbows and nail pits.', 'psoriasis-like'],
  ['An itchy ring-shaped patch with a raised spreading edge and central clearing.', 'tinea-corporis-like'],
  ['Razor bumps with trapped ingrown hairs after shaving my beard line.', 'pseudofolliculitis-like'],
  ['Recurring deep lumps in my armpits with drainage, tunnels and repeated scars.', 'hidradenitis-like'],
  ['Smooth milky white patches with loss of skin colour and no scale.', 'vitiligo-like'],
  ['A sudden smooth bald patch with eyebrow loss.', 'alopecia-areata-like'],
  ['Tight braids caused hairline thinning and broken hairs at my edges.', 'traction-alopecia-like'],
  ['Hair loss spreading from the crown with burning and tenderness; the scalp looks smooth and shiny.', 'ccca-like'],
  ['Itchy firm bumps and raised scars on the back of my neck after a close haircut.', 'acne-keloidalis-nuchae-like'],
  ['Lighter fine scaly patches on my chest that recur in hot humid weather.', 'tinea-versicolor-like'],
  ['Severe itching at night between my fingers and wrists, and other people at home are itchy.', 'scabies-like'],
  ['Rough tiny bumps like chicken skin on my upper arms, not painful.', 'keratosis-pilaris-like'],
  ['Prickly bumps after sweating in hot weather.', 'miliaria-like'],
  ['My skin is painful, hot and swollen with a spreading colour change.', 'cellulitis-like'],
  ['Sores burst and left spreading golden-brown crusts around my mouth.', 'impetigo-like'],
  ['Pain and tingling came before clustered blisters on only one side of my body.', 'shingles-like'],
  ['A lighter patch has reduced feeling and numbness in the patch.', 'numb-patch-like'],
  ['Dark, thickened velvety skin on my neck does not scrub away.', 'velvety-thickening-like'],
  ['A scaly scalp patch has broken hairs, black dots and patchy hair loss.', 'tinea-capitis-like'],
  ['A firm raised scar grew beyond the edge of my old piercing.', 'keloid-scar-like'],
  ['Firm painful lesions are blistering and I have swollen lymph nodes after close contact with mpox.', 'mpox-like'],
  ['A spreading target-like rash appeared after starting a new medicine.', 'severe-medicine-reaction-like'],
  ['A painless swelling on my arm turned into an ulcer and keeps enlarging without fever.', 'painless-ulcer-like'],
] as const;

test('recognizes broader condition-like patterns without labelling them diagnoses', () => {
  for (const [description, expectedId] of patternCases) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.differential.primary?.id, expectedId, description);
    assert.match(assessment.differential.primary?.label ?? '', /pattern/i);
  }
});

test('routes higher-risk patterns to appropriate human review', () => {
  assert.equal(assessClinicalRoutine('Recurring deep lumps in my groin with drainage and tunnels.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Smooth white patches with loss of skin colour and no scale.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('A sudden smooth bald patch.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Hair loss spreading from the crown with burning and tenderness; the scalp looks smooth and shiny.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Itchy firm bumps and raised scars on the back of my neck after a close haircut.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Very itchy dry patches that recur in my elbow folds.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('An itchy ring-shaped patch with a spreading edge on my arm.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('Lighter fine scaly patches on my chest that recur in hot humid weather.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('Severe itching at night between my fingers and wrists, and other people at home are itchy.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('An itchy ring-shaped patch with a spreading edge on my scalp.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Prickly bumps after sweating in hot weather.').referral.level, 'self-care');
  assert.equal(assessClinicalRoutine('My skin is painful, hot and swollen.').referral.level, 'urgent');
  assert.equal(assessClinicalRoutine('Sores burst and left spreading golden-brown crusts.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('Pain and tingling came before clustered blisters on only one side of my body.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('A lighter patch has reduced feeling and numbness in the patch.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('Dark, thickened velvety skin on my neck does not scrub away.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('A scaly scalp patch has broken hairs, black dots and patchy hair loss.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('A firm raised scar grew beyond the edge of my old piercing.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Firm painful lesions are blistering and I have swollen lymph nodes after close contact with mpox.').referral.level, 'urgent');
  assert.equal(assessClinicalRoutine('A spreading target-like rash appeared after starting a new medicine.').referral.level, 'emergency');
  assert.equal(assessClinicalRoutine('A painless swelling on my arm turned into an ulcer and keeps enlarging without fever.').referral.level, 'primary-care');
});

test('medicine-reaction warnings are emergencies while negated fever does not inflate ulcer triage', () => {
  const medicineRash = assessClinicalRoutine('A spreading target-like rash appeared after starting a new medicine.');
  assert.equal(medicineRash.differential.primary?.id, 'severe-medicine-reaction-like');
  assert.equal(medicineRash.referral.level, 'emergency');
  assert.equal(medicineRash.referral.urgency, 'immediate');
  assert.match(medicineRash.referral.action, /emergency hospital care now/i);

  const painlessUlcer = assessClinicalRoutine('A painless swelling on my arm turned into an ulcer and keeps enlarging without fever.');
  assert.equal(painlessUlcer.differential.primary?.id, 'painless-ulcer-like');
  assert.equal(painlessUlcer.referral.level, 'primary-care');
  assert.equal(painlessUlcer.referral.urgency, 'soon');

  for (const description of [
    'A mild rash after starting a new medicine. No blisters and no peeling.',
    'A mild rash after starting a new medicine without blisters or skin peeling.',
  ]) {
    const mildMedicineRash = assessClinicalRoutine(description);
    assert.notEqual(mildMedicineRash.referral.level, 'emergency', description);
    assert.equal(mildMedicineRash.referral.level, 'primary-care', description);
  }
});

test('new guide-parity patterns preserve time-sensitive and higher-risk referral boundaries', () => {
  const naturalShinglesDescription = assessClinicalRoutine('Tingling followed by painful blisters in a band on one side of my face.');
  assert.equal(naturalShinglesDescription.differential.primary?.id, 'shingles-like');
  assert.equal(naturalShinglesDescription.referral.level, 'pharmacist');

  const shingles = assessClinicalRoutine('Clustered blisters on one side of my nose after tingling.');
  assert.equal(shingles.differential.primary?.id, 'shingles-like');
  assert.equal(shingles.referral.level, 'urgent');
  assert.equal(shingles.referral.urgency, 'same-day');

  const infantImpetigo = assessClinicalRoutine('A baby under 1 has sores that burst and left golden-brown crusts.');
  assert.equal(infantImpetigo.differential.primary?.id, 'impetigo-like');
  assert.equal(infantImpetigo.referral.level, 'primary-care');
  assert.equal(infantImpetigo.referral.urgency, 'soon');

  const strokeWarning = assessClinicalRoutine('A numb skin patch with sudden one-sided weakness and speech trouble.');
  assert.equal(strokeWarning.referral.level, 'emergency');
  assert.equal(strokeWarning.referral.urgency, 'immediate');

  const seriousInfection = assessClinicalRoutine('My skin swelling is hot and painful, and I became confused.');
  assert.equal(seriousInfection.referral.level, 'emergency');
  assert.equal(seriousInfection.referral.urgency, 'immediate');
});

test('new observational patterns do not swallow close alternatives', () => {
  assert.equal(
    assessClinicalRoutine('Very itchy blisters exactly where hair dye touched on both sides.').differential.primary?.id,
    'allergic-contact-dermatitis-like',
  );
  assert.equal(
    assessClinicalRoutine('Smooth milky white patches with normal sensation and no scale.').differential.primary?.id,
    'vitiligo-like',
  );
  assert.equal(
    assessClinicalRoutine('Flat dark marks after acne on my cheeks.').differential.primary?.id,
    'post-inflammatory-hyperpigmentation',
  );
  assert.notEqual(assessClinicalRoutine('One pimple has a small pustule and is not spreading.').differential.primary?.id, 'impetigo-like');
  assert.notEqual(assessClinicalRoutine('A small patch is swollen but not painful or warm.').differential.primary?.id, 'cellulitis-like');
  assert.notEqual(assessClinicalRoutine('I am confused about which moisturizer to use for dry skin.').referral.level, 'emergency');
});

test('higher-risk scabies contexts require clinician review', () => {
  const child = assessClinicalRoutine('A child under 2 has itching at night, wrist bumps and itchy lines.');
  assert.equal(child.differential.primary?.id, 'scabies-like');
  assert.equal(child.referral.level, 'primary-care');
  assert.equal(child.referral.urgency, 'soon');
});

test('named conditions interrupt even when ordinary acne ranks alongside them', () => {
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
  ] as const;

  for (const [description, level] of cases) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.referral.level, level, description);
    assert.equal(assessment.referral.urgency, 'soon', description);
  }
});

test('changing skin and nail warnings interrupt without naming a diagnosis', () => {
  const descriptions = [
    'A dark line under my toenail is growing wider.',
    'A dark spot is changing shape and bleeding.',
    'A sore on my foot keeps healing and returning.',
  ];

  for (const description of descriptions) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.referral.level, 'dermatology', description);
    assert.equal(assessment.referral.urgency, 'soon', description);
    assert.match(assessment.referral.action, /prompt in-person skin examination/i, description);
    assert.doesNotMatch(JSON.stringify(assessment.referral), /melanoma|cancer|diagnos/i, description);
  }
});

test('eye and infection warning terms interrupt ordinary guidance', () => {
  const eye = assessClinicalRoutine('Persistent facial redness with eye pain and blurred vision.');
  assert.equal(eye.referral.level, 'urgent');
  assert.equal(eye.referral.urgency, 'same-day');

  const infection = assessClinicalRoutine('My itchy dry patches are hot and swollen and I have chills.');
  assert.equal(infection.referral.level, 'urgent');
});
