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
  assert.equal(assessClinicalRoutine('Very itchy dry patches that recur in my elbow folds.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('An itchy ring-shaped patch with a spreading edge on my arm.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('An itchy ring-shaped patch with a spreading edge on my scalp.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Prickly bumps after sweating in hot weather.').referral.level, 'self-care');
});

test('eye and infection warning terms interrupt ordinary guidance', () => {
  const eye = assessClinicalRoutine('Persistent facial redness with eye pain and blurred vision.');
  assert.equal(eye.referral.level, 'urgent');
  assert.equal(eye.referral.urgency, 'same-day');

  const infection = assessClinicalRoutine('My itchy dry patches are hot and swollen and I have chills.');
  assert.equal(infection.referral.level, 'urgent');
});
