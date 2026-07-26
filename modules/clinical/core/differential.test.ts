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
  ['Severe itching with firm lumps under my skin and my vision is getting worse.', 'onchocerciasis-like'],
  ['My leg has stayed swollen for months and the skin is becoming thick and hard.', 'chronic-lymphoedema-like'],
  ['A child has a wart-like growth on the leg that became an ulcer.', 'infectious-papilloma-ulcer-like'],
  ['A painless foot mass has several draining holes with black grains.', 'deep-draining-mass-like'],
  ['Sudden itchy same-size bumps centred on hairs after sweating in tight clothing.', 'folliculitis'],
  ['A hard painful lump has a soft centre and is leaking pus.', 'boil-abscess-like'],
  ['I used an unlabelled bleaching cream and the label mentions mercury.', 'skin-lightening-exposure-like'],
  ['Many small acne-like bumps around my mouth burn and flake after hydrocortisone on my face.', 'periorificial-dermatitis-like'],
  ['Raised itchy patches appear and disappear within hours and move around my body.', 'urticaria-like'],
  ['Tingling came before small fluid-filled blisters on my lip that crusted into a scab.', 'cold-sore-like'],
  ['Itchy white peeling skin is cracked between my toes.', 'tinea-pedis-like'],
  ['My thick yellow toenail is crumbly and lifting.', 'nail-change-like'],
  ['A mole is changing and bleeding.', 'changing-skin-mark-like'],
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
  assert.equal(assessClinicalRoutine('Severe itching with firm lumps under my skin.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('My leg has stayed swollen for months and the skin is becoming thick and hard.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('A child has a wart-like growth on the leg that became an ulcer.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('A painless foot mass has several draining holes with black grains.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('Sudden itchy same-size bumps centred on hairs after sweating in tight clothing.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('A hard painful lump has a soft centre and is leaking pus.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('I used an unlabelled bleaching cream and the label mentions mercury.').referral.level, 'primary-care');
  assert.equal(assessClinicalRoutine('Many small acne-like bumps around my mouth burn and flake after hydrocortisone on my face.').referral.level, 'dermatology');
  assert.equal(assessClinicalRoutine('Raised itchy patches appear and disappear within hours and move around my body.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('Tingling came before small fluid-filled blisters on my lip that crusted into a scab.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('Itchy white peeling skin is cracked between my toes.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('My thick yellow toenail is crumbly and lifting.').referral.level, 'pharmacist');
  assert.equal(assessClinicalRoutine('A mole is changing and bleeding.').referral.level, 'dermatology');
});

test('wart-like ulcer warnings stop skincare without swallowing nearby patterns', () => {
  for (const description of [
    'A child has a wart-like growth on the leg that became an ulcer.',
    'A child has multiple raised yellow skin lesions after one wart-like growth.',
    'I was told this could be yaws and I also have oily acne.',
  ]) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.differential.primary?.id, 'infectious-papilloma-ulcer-like', description);
    assert.equal(assessment.referral.level, 'primary-care', description);
    assert.equal(assessment.referral.urgency, 'soon', description);
  }

  assert.notEqual(assessClinicalRoutine('One stable ordinary wart has not changed.').differential.primary?.id, 'infectious-papilloma-ulcer-like');
  assert.equal(assessClinicalRoutine('An itchy ring-shaped scaly patch has central clearing.').differential.primary?.id, 'tinea-corporis-like');
  assert.equal(assessClinicalRoutine('Sores burst and left spreading golden-brown crusts.').differential.primary?.id, 'impetigo-like');
  assert.equal(assessClinicalRoutine('A painless swelling became an ulcer and keeps enlarging.').differential.primary?.id, 'painless-ulcer-like');
  assert.equal(assessClinicalRoutine('Firm painful lesions blistered with swollen glands after close contact with mpox.').differential.primary?.id, 'mpox-like');
});

test('slow draining swellings stop skincare without swallowing nearby patterns', () => {
  for (const description of [
    'A painless foot mass has several draining holes with black grains.',
    'My foot has slowly swollen and now has draining sinuses with white grains.',
    'I was told this could be mycetoma and I also have oily acne.',
    'Madura foot with multiple draining holes.',
  ]) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.differential.primary?.id, 'deep-draining-mass-like', description);
    assert.equal(assessment.referral.level, 'primary-care', description);
    assert.equal(assessment.referral.urgency, 'soon', description);
  }

  const urgent = assessClinicalRoutine('A painless foot mass with draining holes and grains now has fever and severe pain.');
  assert.equal(urgent.referral.level, 'urgent');
  assert.equal(urgent.referral.urgency, 'same-day');

  assert.equal(assessClinicalRoutine('A painless swelling on my arm turned into an ulcer and keeps enlarging.').differential.primary?.id, 'painless-ulcer-like');
  assert.equal(assessClinicalRoutine('Recurring deep lumps in my armpits with drainage, tunnels and scars.').differential.primary?.id, 'hidradenitis-like');
  assert.equal(assessClinicalRoutine('My leg has stayed swollen for months and the skin is becoming thick and hard.').differential.primary?.id, 'chronic-lymphoedema-like');
  assert.notEqual(assessClinicalRoutine('One stable plantar wart has not changed.').differential.primary?.id, 'deep-draining-mass-like');
});

test('persistent swelling stops skincare while acute clot and infection warnings keep priority', () => {
  const chronic = assessClinicalRoutine('My leg has stayed swollen for months and the skin is becoming thick and hard.');
  assert.equal(chronic.differential.primary?.id, 'chronic-lymphoedema-like');
  assert.equal(chronic.referral.level, 'primary-care');
  assert.equal(chronic.referral.urgency, 'soon');

  const named = assessClinicalRoutine('I was told this could be elephantiasis and one leg is very swollen.');
  assert.equal(named.differential.primary?.id, 'chronic-lymphoedema-like');
  assert.equal(named.referral.level, 'primary-care');

  const acute = assessClinicalRoutine('Today my right leg suddenly became painful and swollen, and it feels warm.');
  assert.equal(acute.referral.level, 'urgent');
  assert.equal(acute.referral.urgency, 'same-day');

  const emergency = assessClinicalRoutine('My leg is painful and swollen and I have chest pain.');
  assert.equal(emergency.referral.level, 'emergency');
  assert.equal(emergency.referral.urgency, 'immediate');

  assert.equal(assessClinicalRoutine('My swollen leg is now hot, more painful and I feel shivery.').referral.level, 'urgent');
  assert.equal(assessClinicalRoutine('Painful hot spreading swelling with fever.').differential.primary?.id, 'cellulitis-like');
  assert.notEqual(assessClinicalRoutine('My ankles get puffy after standing but go down overnight.').differential.primary?.id, 'chronic-lymphoedema-like');
  assert.notEqual(assessClinicalRoutine('A mosquito bit my leg yesterday.').differential.primary?.id, 'chronic-lymphoedema-like');
});

test('eye-and-skin warning patterns stop products without swallowing close alternatives', () => {
  const symptoms = assessClinicalRoutine('Severe itching with lumps under my skin and my vision is getting worse.');
  assert.equal(symptoms.differential.primary?.id, 'onchocerciasis-like');
  assert.equal(symptoms.referral.level, 'urgent');
  assert.equal(symptoms.referral.urgency, 'same-day');

  const suddenSightLoss = assessClinicalRoutine('I suddenly cannot see from my left eye.');
  assert.equal(suddenSightLoss.referral.level, 'emergency');
  assert.equal(suddenSightLoss.referral.urgency, 'immediate');

  assert.equal(assessClinicalRoutine('Severe itching at night and my household is itchy.').differential.primary?.id, 'scabies-like');
  assert.equal(assessClinicalRoutine('Painful draining lumps and armpit tunnels.').differential.primary?.id, 'hidradenitis-like');
  assert.equal(assessClinicalRoutine('Very itchy dry patches in my elbow folds.').differential.primary?.id, 'atopic-dermatitis-like');
  assert.notEqual(assessClinicalRoutine('I live near a fast-flowing river.').differential.primary?.id, 'onchocerciasis-like');
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
  assert.notEqual(assessClinicalRoutine('One pimple has a small pustule and is not spreading.').differential.primary?.id, 'boil-abscess-like');
  assert.equal(
    assessClinicalRoutine('Recurring deep painful boils in my armpits with tunnels and repeated scars.').differential.primary?.id,
    'hidradenitis-like',
  );
  assert.equal(
    assessClinicalRoutine('Many uniform same-size bumps centred on hairs after sweating.').differential.primary?.id,
    'folliculitis',
  );
  assert.notEqual(
    assessClinicalRoutine('Flat dark marks after acne on my cheeks.').differential.primary?.id,
    'skin-lightening-exposure-like',
  );
  assert.notEqual(assessClinicalRoutine('A small patch is swollen but not painful or warm.').differential.primary?.id, 'cellulitis-like');
  assert.notEqual(assessClinicalRoutine('I am confused about which moisturizer to use for dry skin.').referral.level, 'emergency');
});

test('boil and abscess warnings preserve face and health-risk referral boundaries', () => {
  const face = assessClinicalRoutine('I have a painful boil on my face with a soft centre.');
  assert.equal(face.differential.primary?.id, 'boil-abscess-like');
  assert.equal(face.referral.level, 'urgent');
  assert.equal(face.referral.urgency, 'same-day');

  const diabetes = assessClinicalRoutine('I have diabetes and a hard painful boil on my leg.');
  assert.equal(diabetes.differential.primary?.id, 'boil-abscess-like');
  assert.equal(diabetes.referral.level, 'urgent');
  assert.equal(diabetes.referral.urgency, 'same-day');

  const ordinary = assessClinicalRoutine('A hard painful lump has a soft centre and is leaking pus.');
  assert.equal(ordinary.referral.level, 'primary-care');
  assert.equal(ordinary.referral.urgency, 'soon');
  assert.match(ordinary.referral.action, /in-person medical examination/i);
});

test('higher-risk scabies contexts require clinician review', () => {
  const child = assessClinicalRoutine('A child under 2 has itching at night, wrist bumps and itchy lines.');
  assert.equal(child.differential.primary?.id, 'scabies-like');
  assert.equal(child.referral.level, 'primary-care');
  assert.equal(child.referral.urgency, 'soon');
});

test('facial acne look-alikes route to examination without swallowing acne or infections', () => {
  const lookAlike = assessClinicalRoutine('Many small acne-like bumps around my mouth burn and flake after hydrocortisone on my face.');
  assert.equal(lookAlike.differential.primary?.id, 'periorificial-dermatitis-like');
  assert.equal(lookAlike.referral.level, 'dermatology');
  assert.equal(lookAlike.referral.urgency, 'soon');
  assert.match(lookAlike.referral.action, /in-person skin examination/i);
  assert.match(lookAlike.referral.action, /prescriber before changing any prescribed steroid/i);

  assert.equal(assessClinicalRoutine('Blackheads and whiteheads on my forehead and chin with oily skin.').differential.primary?.id, 'acne-vulgaris');
  assert.equal(assessClinicalRoutine('Tingling came before fluid-filled blisters on my lip.').differential.primary?.id, 'cold-sore-like');
  assert.equal(assessClinicalRoutine('Sores burst and left spreading golden-brown crusts around my mouth.').differential.primary?.id, 'impetigo-like');
});

test('raised itchy welts preserve allergy emergencies and close rash alternatives', () => {
  const ordinary = assessClinicalRoutine('Raised itchy patches appear and disappear within hours and move around my body.');
  assert.equal(ordinary.differential.primary?.id, 'urticaria-like');
  assert.equal(ordinary.referral.level, 'pharmacist');
  assert.equal(ordinary.referral.urgency, 'soon');

  const deeperSwelling = assessClinicalRoutine('I have hives with swelling under my skin on my hands.');
  assert.equal(deeperSwelling.differential.primary?.id, 'urticaria-like');
  assert.equal(deeperSwelling.referral.level, 'urgent');
  assert.equal(deeperSwelling.referral.urgency, 'same-day');

  const spreading = assessClinicalRoutine('My hives rash is spreading and I feel unwell.');
  assert.equal(spreading.differential.primary?.id, 'urticaria-like');
  assert.equal(spreading.referral.level, 'urgent');
  assert.equal(spreading.referral.urgency, 'same-day');

  const mouthSwelling = assessClinicalRoutine('I have hives and my lips and mouth are suddenly swollen.');
  assert.equal(mouthSwelling.referral.level, 'emergency');
  assert.equal(mouthSwelling.referral.urgency, 'immediate');

  const emergency = assessClinicalRoutine('I have hives and my tongue is swollen and I am struggling to breathe.');
  assert.equal(emergency.referral.level, 'emergency');
  assert.equal(emergency.referral.urgency, 'immediate');

  assert.equal(assessClinicalRoutine('Severe itching at night and other people at home are itchy.').differential.primary?.id, 'scabies-like');
  assert.equal(assessClinicalRoutine('A fixed ring-shaped scaly patch has a raised edge.').differential.primary?.id, 'tinea-corporis-like');
});

test('tingling facial blisters preserve eye and newborn referral boundaries', () => {
  const ordinary = assessClinicalRoutine('Tingling came before small fluid-filled blisters on my lip that crusted into a scab.');
  assert.equal(ordinary.differential.primary?.id, 'cold-sore-like');
  assert.equal(ordinary.referral.level, 'pharmacist');
  assert.equal(ordinary.referral.urgency, 'soon');

  const eyeArea = assessClinicalRoutine('I have a cold sore with blisters near my eye.');
  assert.equal(eyeArea.differential.primary?.id, 'cold-sore-like');
  assert.equal(eyeArea.referral.level, 'urgent');
  assert.equal(eyeArea.referral.urgency, 'same-day');

  const newborn = assessClinicalRoutine('I have an active cold sore and kissed my newborn.');
  assert.equal(newborn.differential.primary?.id, 'cold-sore-like');
  assert.equal(newborn.referral.level, 'urgent');
  assert.equal(newborn.referral.urgency, 'same-day');

  assert.notEqual(assessClinicalRoutine('One canker sore inside my mouth.').differential.primary?.id, 'cold-sore-like');
  assert.equal(assessClinicalRoutine('Pain and tingling came before clustered blisters in a band on one side of my body.').differential.primary?.id, 'shingles-like');
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
    ['I was told this could be river blindness and I also have oily acne.', 'primary-care'],
    ['I have lymphoedema and oily acne on my forehead.', 'primary-care'],
    ['I was told this could be yaws and I also have oily acne.', 'primary-care'],
    ['I was told this could be noma and I also have oily acne.', 'urgent'],
    ['I have folliculitis and oily acne.', 'primary-care'],
    ['I have a boil and oily acne.', 'primary-care'],
    ['I used a bleaching cream and also have oily acne.', 'primary-care'],
  ] as const;

  for (const [description, level] of cases) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.referral.level, level, description);
    assert.equal(assessment.referral.urgency, level === 'urgent' ? 'same-day' : 'soon', description);
  }
});

test('rapid gum-to-face changes fail closed without swallowing close alternatives', () => {
  const urgent = [
    'A child has swollen gums and facial swelling that is getting worse quickly.',
    'A gum sore is spreading into the cheek and the mouth tissue is turning dark.',
    'I was told this could be noma and I also have oily acne.',
  ];
  for (const description of urgent) {
    const assessment = assessClinicalRoutine(description);
    assert.equal(assessment.differential.primary?.id, 'rapid-mouth-face-breakdown-like', description);
    assert.equal(assessment.referral.level, 'urgent', description);
    assert.equal(assessment.referral.urgency, 'same-day', description);
  }

  for (const description of [
    'A gum sore is spreading into the face and the child cannot swallow.',
    'My gum sore is spreading quickly into my cheek and my face is swelling. It is difficult to swallow.',
  ]) {
    const emergency = assessClinicalRoutine(description);
    assert.equal(emergency.differential.primary?.id, 'rapid-mouth-face-breakdown-like', description);
    assert.equal(emergency.referral.level, 'emergency', description);
    assert.equal(emergency.referral.urgency, 'immediate', description);
  }

  for (const description of [
    'My gums bleed a little when brushing.',
    'I have one stable canker sore with no swelling.',
    'One painful tooth has a small local gum swelling.',
  ]) assert.notEqual(
    assessClinicalRoutine(description).differential.primary?.id,
    'rapid-mouth-face-breakdown-like',
    description,
  );

  assert.equal(
    assessClinicalRoutine('Golden-brown external sores with spreading crusts around the mouth.').differential.primary?.id,
    'impetigo-like',
  );
  assert.equal(
    assessClinicalRoutine('A target-like rash with mouth sores appeared after a new medicine.').differential.primary?.id,
    'severe-medicine-reaction-like',
  );
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

test('new foot and nail patterns preserve close alternatives and fail closed at higher-risk boundaries', () => {
  const athleteFoot = assessClinicalRoutine('Itchy white peeling skin is cracked between my toes.');
  assert.equal(athleteFoot.differential.primary?.id, 'tinea-pedis-like');
  assert.equal(athleteFoot.referral.level, 'pharmacist');
  assert.equal(athleteFoot.referral.urgency, 'soon');

  const diabeticFoot = assessClinicalRoutine('I have diabetes and itchy white peeling skin cracked between my toes.');
  assert.equal(diabeticFoot.differential.primary?.id, 'tinea-pedis-like');
  assert.equal(diabeticFoot.referral.level, 'primary-care');
  assert.equal(diabeticFoot.referral.urgency, 'soon');

  const nail = assessClinicalRoutine('My thick yellow toenail is crumbly and lifting.');
  assert.equal(nail.differential.primary?.id, 'nail-change-like');
  assert.equal(nail.referral.level, 'pharmacist');
  assert.equal(nail.referral.urgency, 'soon');

  const darkBand = assessClinicalRoutine('A dark line under my toenail is growing wider.');
  assert.equal(darkBand.referral.level, 'dermatology');
  assert.equal(darkBand.referral.urgency, 'soon');

  assert.notEqual(assessClinicalRoutine('A smooth bald patch with no scale.').differential.primary?.id, 'tinea-pedis-like');
  assert.notEqual(assessClinicalRoutine('One stable normal toenail has not changed.').differential.primary?.id, 'nail-change-like');
  assert.notEqual(assessClinicalRoutine('One stable ordinary mole has not changed.').differential.primary?.id, 'changing-skin-mark-like');
});

test('eye and infection warning terms interrupt ordinary guidance', () => {
  const eye = assessClinicalRoutine('Persistent facial redness with eye pain and blurred vision.');
  assert.equal(eye.referral.level, 'urgent');
  assert.equal(eye.referral.urgency, 'same-day');

  const infection = assessClinicalRoutine('My itchy dry patches are hot and swollen and I have chills.');
  assert.equal(infection.referral.level, 'urgent');
});
