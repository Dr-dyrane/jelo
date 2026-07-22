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
