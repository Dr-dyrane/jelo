import type { BarrierAssessment, ClinicalFinding, DifferentialAssessment, PatientProfile, ReferralAssessment } from './types';

const emergencyTerms = ['trouble breathing', 'difficulty breathing', 'swollen tongue', 'swollen throat', 'fainting', 'anaphylaxis'];
const urgentTerms = ['rapidly spreading', 'severe pain', 'eye swelling', 'face swelling', 'blistering', 'skin peeling', 'fever', 'infected', 'painful rash', 'eye pain', 'blurred vision', 'light sensitivity', 'red eye', 'hot and swollen', 'chills', 'shivery'];
const specialistTerms = ['scarring', 'deep cyst', 'nodules', 'persistent redness', 'visible veins', 'recurrent rash', 'months', 'not improving'];
const changingLesionPatterns = [
  { pattern: /\b(?:spot|mole|mark|growth|bump)\b.{0,64}\b(?:changing|changes|changed|growing|bleeding|bleeds|irregular)\b/i, reason: 'A changing, growing, bleeding or irregular skin mark was reported.' },
  { pattern: /\b(?:changing|changes|changed|growing|bleeding|bleeds|irregular)\b.{0,64}\b(?:spot|mole|mark|growth|bump)\b/i, reason: 'A changing, growing, bleeding or irregular skin mark was reported.' },
  { pattern: /\b(?:dark|brown|black)\s+(?:line|band|streak)\b.{0,48}\b(?:finger|toe)?nail\b/i, reason: 'A dark line or band in or around a nail was reported.' },
  { pattern: /\b(?:sore|ulcer|wound)\b.{0,80}\b(?:does(?:\s+not|n't)|will\s+not|won't|not)\s+heal\b/i, reason: 'A sore that is not healing was reported.' },
  { pattern: /\b(?:sore|ulcer|wound)\b.{0,80}\bheal(?:s|ed|ing)?\b.{0,32}\b(?:return(?:s|ed|ing)?|come(?:s)?\s+back|recur(?:s|red|ring)?)\b/i, reason: 'A sore that heals and returns was reported.' },
];
const strokeWarningPatterns = [
  /\bsudden(?:ly)?\b.{0,40}\b(?:one-sided|one sided)\b.{0,40}\bweakness\b/i,
  /\bsudden(?:ly)?\b.{0,60}\b(?:face drooping|slurred speech|speech trouble|difficulty speaking)\b/i,
  /\b(?:face drooping|slurred speech|speech trouble|difficulty speaking)\b.{0,40}\b(?:began|started|came on)\s+sudden(?:ly)?\b/i,
];
const suddenVisionLossPatterns = [
  /\bsudden(?:ly)?\b.{0,28}\b(?:cannot|can't|could not|couldn't|unable to)\s+see\b/i,
  /\bsudden(?:ly)?\b.{0,28}\b(?:vision|sight)\s+(?:loss|lost|gone)\b/i,
  /\bsudden inability to see\b/i,
];
const swollenLimbEmergencyPatterns = [
  /\b(?:leg|arm|limb)\b.{0,64}\b(?:pain|painful|swollen|swelling)\b.{0,96}\b(?:chest pain|shortness of breath|short of breath|breathless|coughing blood|collapse|collapsed)\b/i,
  /\b(?:chest pain|shortness of breath|short of breath|breathless|coughing blood|collapse|collapsed)\b.{0,96}\b(?:leg|arm|limb)\b.{0,64}\b(?:pain|painful|swollen|swelling)\b/i,
];
const suddenOneSidedLimbSwelling = /\b(?:sudden(?:ly)?|new|today)\b.{0,64}\b(?:one|left|right)?\s*(?:leg|arm|limb)\b.{0,64}\b(?:swollen|swelling)\b/i;
const seriousInfectionContext = /\b(?:skin|rash|swelling|cellulitis)\b/i;
const seriousInfectionWarning = /\b(?:shaking|fast breathing|fast heartbeat|purple patches|confusion|disorient(?:ed|ation)|became confused|feel confused|suddenly confused|cold clammy skin|collapse|collapsed)\b/i;
const namedSevereMedicineReaction = /\b(?:sjs|stevens[- ]johnson syndrome|toxic epidermal necrolysis)\b/i;
const medicineMention = /\b(?:medicine|medication|drug|antibiotic|painkiller)\b/i;
const rapidMouthFaceEmergency = /\b(?:gum|gums|mouth)\b.{0,120}\b(?:cheek|face|facial|tissue)\b/i;
const cannotSwallowOrDrink = /\b(?:(?:cannot|can't|could not|couldn't|unable to)\s+(?:swallow|drink)|(?:difficulty|trouble)\s+(?:with\s+)?(?:swallowing|drinking)|(?:difficult|hard|very\s+hard)\s+to\s+(?:swallow|drink))\b/i;
const severeMouthFaceDecline = /\b(?:confusion|confused|collapse|collapsed|severe weakness|very weak)\b/i;

function hasSevereMedicineReactionWarning(text: string) {
  if (namedSevereMedicineReaction.test(text)) return true;
  if (!medicineMention.test(text)) return false;
  if (!/\b(?:rash|skin|patch(?:es)?|blister(?:s|ed|ing)?|peel(?:s|ed|ing)?|sores?)\b/i.test(text)) return false;
  const spreadingOrTarget = /\b(?:spreading|target[- ]like|circular[^.]{0,32}darker in the middle)\b/i.test(text);
  const blistering = /\bblister(?:s|ed|ing)?\b/i.test(text) && !/\b(?:no|without)\b[^.;]{0,28}\bblister(?:s|ing)?\b/i.test(text);
  const peeling = /\bpeel(?:s|ed|ing)?\b/i.test(text) && !/\b(?:no|without)\b[^.;]{0,28}\b(?:skin\s+)?peel(?:s|ing)?\b/i.test(text);
  const mucosalSores = /\b(?:mouth|eye|throat|genital)\s+sores?\b/i.test(text)
    && !/\b(?:no|without)\s+(?:mouth|eye|throat|genital)(?:\s+or\s+(?:mouth|eye|throat|genital))*\s+sores?\b/i.test(text);
  return spreadingOrTarget || blistering || peeling || mucosalSores;
}

function hits(text: string, terms: string[]) {
  return terms.filter(term => {
    if (!text.includes(term)) return false;
    if (term === 'fever' && /\b(?:no|without|not having|do not have|don't have)\s+(?:a\s+)?fever\b/.test(text)) return false;
    if (term === 'chills' && /\b(?:no|without|not having|do not have|don't have)\s+chills\b/.test(text)) return false;
    if (term === 'skin peeling' && /\b(?:no|without)\b[^.;]{0,28}\bskin peeling\b/.test(text)) return false;
    return true;
  });
}

function changingLesionHits(text: string) {
  return Array.from(new Set(changingLesionPatterns.filter(item => item.pattern.test(text)).map(item => item.reason)));
}

function mentionsNamedPattern(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function assessReferral(input: {
  text: string;
  profile: PatientProfile;
  barrier: BarrierAssessment;
  findings: ClinicalFinding[];
  differential: DifferentialAssessment;
}): ReferralAssessment {
  const normalized = input.text.toLowerCase();
  if (strokeWarningPatterns.some(pattern => pattern.test(input.text))) return {
    level: 'emergency', urgency: 'immediate', reasons: ['Sudden weakness or speech trouble was reported.'],
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  if (suddenVisionLossPatterns.some(pattern => pattern.test(input.text))) return {
    level: 'emergency', urgency: 'immediate', reasons: ['Sudden loss of sight was reported.'],
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  if (swollenLimbEmergencyPatterns.some(pattern => pattern.test(input.text))) return {
    level: 'emergency', urgency: 'immediate', reasons: ['Limb pain or swelling with a breathing or chest warning sign was reported.'],
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  if (seriousInfectionContext.test(input.text) && seriousInfectionWarning.test(input.text)) return {
    level: 'emergency', urgency: 'immediate', reasons: ['A serious infection warning sign was reported with a skin change.'],
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  if (hasSevereMedicineReactionWarning(input.text)) return {
    level: 'emergency', urgency: 'immediate', reasons: ['A severe medicine-reaction warning pattern was reported.'],
    action: 'Seek emergency hospital care now and bring every medicine you take. Do not rely on skincare self-treatment.',
  };

  if (
    rapidMouthFaceEmergency.test(input.text)
    && (cannotSwallowOrDrink.test(input.text) || severeMouthFaceDecline.test(input.text))
  ) return {
    level: 'emergency', urgency: 'immediate', reasons: ['A rapidly worsening mouth-and-face change with an emergency warning sign was reported.'],
    action: 'Seek emergency hospital care now. Do not wait for skincare, mouthwash or home treatment to work.',
  };

  const emergency = hits(normalized, emergencyTerms);
  if (emergency.length) return {
    level: 'emergency', urgency: 'immediate', reasons: emergency.map(term => `Reported ${term}.`),
    action: 'Seek emergency care now. Do not rely on skincare self-treatment.',
  };

  if (
    suddenOneSidedLimbSwelling.test(input.text)
    && /\b(?:pain|painful|warm|hot|tender|darkened)\b/i.test(input.text)
  ) return {
    level: 'urgent', urgency: 'same-day', reasons: ['New one-sided limb swelling with pain, warmth or tenderness was reported.'],
    action: 'Arrange same-day in-person medical assessment for a serious cause. Do not rely on skincare self-treatment.',
  };

  const primaryId = input.differential.primary?.id;
  if (primaryId === 'rapid-mouth-face-breakdown-like' || mentionsNamedPattern(normalized, /\b(?:noma|cancrum oris|gangrenous stomatitis)\b/)) return {
    level: 'urgent', urgency: 'same-day', reasons: ['A rapidly worsening gum-to-face warning pattern was reported.'],
    action: 'Arrange urgent in-person medical assessment today. Do not wait for skincare, mouthwash or home treatment to work.',
  };

  const urgent = hits(normalized, urgentTerms);
  if (urgent.length || input.findings.some(item => item.severity === 'urgent')) return {
    level: 'urgent', urgency: 'same-day', reasons: [...urgent.map(term => `Reported ${term}.`), ...input.findings.filter(item => item.severity === 'urgent').map(item => item.title)].slice(0, 5),
    action: 'Arrange same-day in-person medical assessment.',
  };

  const changingLesion = changingLesionHits(input.text);
  if (changingLesion.length) return {
    level: 'dermatology', urgency: 'soon', reasons: changingLesion,
    action: 'Arrange a prompt in-person skin examination. Do not rely on skincare products for this change.',
  };

  const weakenedImmunity = /\b(?:immunocompromised|weakened immune|suppressed immune|chemotherapy)\b/.test(normalized);

  if (primaryId === 'onchocerciasis-like' || mentionsNamedPattern(normalized, /\b(?:onchocerciasis|river blindness)\b/)) {
    const eyeChange = /\b(?:(?:blurred|reduced|worsening|changing)\s+(?:vision|sight)|(?:vision|sight)(?:\s+is)?\s+(?:change|changes|changing|worsening|getting worse|reduced|blurred|loss)|eye pain|red eye|light sensitivity)\b/.test(normalized);
    return eyeChange ? {
      level: 'urgent', urgency: 'same-day', reasons: ['An eye-and-skin warning pattern with sight or eye changes was reported.'],
      action: 'Arrange same-day in-person medical and eye assessment. Do not start treatment on your own.',
    } : {
      level: 'primary-care', urgency: 'soon', reasons: ['A severe itch-with-nodule or named eye-and-skin infection pattern was reported.'],
      action: 'Arrange a prompt in-person medical examination, including an eye assessment. Do not start treatment on your own.',
    };
  }

  if (primaryId === 'chronic-lymphoedema-like' || mentionsNamedPattern(normalized, /\b(?:lymphatic filariasis|elephantiasis|lymphoedema|lymphedema)\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A persistent swelling-with-skin-change pattern was reported.'],
    action: 'Arrange a prompt in-person medical assessment to identify the cause and plan continuing care. Do not rely on cosmetic products or start antiparasitic treatment on your own.',
  };

  if (primaryId === 'cellulitis-like') return {
    level: 'urgent', urgency: 'same-day', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange same-day in-person medical assessment.',
  };

  if (primaryId === 'shingles-like') {
    const higherRisk = (
      input.profile.pregnant
      || (input.profile.breastfeeding && /\bbreast\b/.test(normalized))
      || (typeof input.profile.age === 'number' && input.profile.age < 18)
      || weakenedImmunity
      || /\b(?:eye|nose|vision|sight)\b/.test(normalized)
    );
    return higherRisk ? {
      level: 'urgent', urgency: 'same-day', reasons: [`The leading pattern is ${input.differential.primary?.label}.`, 'A higher-risk context was reported.'],
      action: 'Arrange urgent in-person medical assessment today.',
    } : {
      level: 'pharmacist', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
      action: 'Ask a pharmacist or clinician promptly, ideally within 3 days of the rash appearing.',
    };
  }

  if (primaryId === 'impetigo-like') {
    const higherRisk = (
      (typeof input.profile.age === 'number' && input.profile.age < 1)
      || /\b(?:baby under 1|baby under one|infant under 1|infant under one)\b/.test(normalized)
      || (input.profile.breastfeeding && /\bbreast\b/.test(normalized))
      || weakenedImmunity
      || /\b(?:came back|recurred|worse after treatment|worsening after treatment)\b/.test(normalized)
    );
    return higherRisk ? {
      level: 'primary-care', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`, 'A higher-risk context was reported.'],
      action: 'Arrange clinician review before choosing treatment.',
    } : {
      level: 'pharmacist', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
      action: 'Ask a pharmacist or clinician to confirm the pattern before choosing treatment.',
    };
  }

  if (primaryId === 'boil-abscess-like' || mentionsNamedPattern(normalized, /\b(?:boil|boils|skin abscess|carbuncle)\b/)) {
    const higherRisk = (
      /\b(?:on|near)\s+(?:my|the)\s+face\b/.test(normalized)
      || /\b(?:diabetes|diabetic|weakened immune|suppressed immune|immunocompromised|chemotherapy|steroid treatment)\b/.test(normalized)
    );
    return higherRisk ? {
      level: 'urgent', urgency: 'same-day', reasons: ['A boil-or-abscess warning pattern and a higher-risk context were reported.'],
      action: 'Arrange same-day in-person medical assessment. Do not squeeze, pierce or rely on skincare products.',
    } : {
      level: 'primary-care', urgency: 'soon', reasons: ['A boil-or-abscess warning pattern was reported.'],
      action: 'Arrange an in-person medical examination; a clinician may need to drain the lump or choose medicine. Do not squeeze, pierce or self-start antibiotics.',
    };
  }

  if (primaryId === 'skin-lightening-exposure-like' || mentionsNamedPattern(normalized, /\b(?:skin[- ]lightening (?:product|cream|soap)|bleaching (?:cream|soap)|mercury (?:cream|soap))\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A potentially unsafe skin-lightening product exposure was reported.'],
    action: 'Stop using the suspected product, keep its container and ingredient list, and arrange prompt medical or poison-service advice. Do not add another lightening product.',
  };

  if (primaryId === 'folliculitis' || mentionsNamedPattern(normalized, /\bfolliculitis\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A follicle-centred bump pattern was reported.'],
    action: 'Arrange an in-person skin review if this persists, recurs, hurts or remains uncertain; acne and folliculitis can look alike. Do not self-start antibiotics.',
  };

  if (primaryId === 'numb-patch-like') return {
    level: 'primary-care', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange a prompt in-person examination. Do not test the patch with heat or sharp objects.',
  };

  if (primaryId === 'velvety-thickening-like') return {
    level: 'primary-care', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange a medical review to assess the cause. Do not scrub or treat this as surface dirt.',
  };

  if (primaryId === 'severe-medicine-reaction-like') return {
    level: 'primary-care', urgency: 'soon', reasons: ['A rash beginning after a medicine was reported.'],
    action: 'Contact a clinician or pharmacist promptly. Seek emergency hospital care now if the rash spreads, becomes painful, blisters or peels, or affects the mouth, eyes, throat or genitals.',
  };

  if (primaryId === 'tinea-capitis-like' || mentionsNamedPattern(normalized, /\b(?:tinea capitis|scalp ringworm)\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A scalp fungal-infection pattern was reported.'],
    action: 'Arrange an in-person clinician review; scalp ringworm usually needs prescription treatment rather than a skin cream alone.',
  };

  if (primaryId === 'keloid-scar-like' || mentionsNamedPattern(normalized, /\bkeloid(?: scar)?\b/)) return {
    level: 'dermatology', urgency: 'soon', reasons: ['A growing raised-scar pattern was reported.'],
    action: 'Arrange a non-urgent dermatology or primary-care examination before choosing scar treatment.',
  };

  if (primaryId === 'mpox-like' || mentionsNamedPattern(normalized, /\b(?:mpox|monkeypox)\b/)) {
    const higherRisk = input.profile.pregnant
      || (typeof input.profile.age === 'number' && input.profile.age < 18)
      || weakenedImmunity
      || /\b(?:dehydrat(?:ed|ion)|eye|vision|breathing|confusion)\b/.test(normalized);
    return higherRisk ? {
      level: 'urgent', urgency: 'same-day', reasons: ['An infectious-lesion pattern and a higher-risk context were reported.'],
      action: 'Arrange urgent in-person medical assessment today and avoid close contact until assessed.',
    } : {
      level: 'primary-care', urgency: 'soon', reasons: ['An infectious-lesion pattern was reported.'],
      action: 'Contact a health service promptly for testing advice and avoid close contact or sharing personal items until assessed.',
    };
  }

  if (primaryId === 'infectious-papilloma-ulcer-like' || mentionsNamedPattern(normalized, /\b(?:yaws|framboesia)\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A wart-like growth-to-ulcer or named infectious skin pattern was reported.'],
    action: 'Arrange a prompt in-person examination through a clinic or skin-NTD service. Avoid direct contact with the lesion, and do not use cosmetic treatment or start antibiotics without clinical direction.',
  };

  if (primaryId === 'deep-draining-mass-like' || mentionsNamedPattern(normalized, /\b(?:mycetoma|madura foot)\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A slow swelling-with-drainage or named deep-infection pattern was reported.'],
    action: 'Arrange a prompt in-person medical examination through a clinic or skin-NTD service. Do not cut or squeeze the swelling, and do not start antibiotic or antifungal treatment without clinical direction.',
  };

  if (primaryId === 'painless-ulcer-like' || mentionsNamedPattern(normalized, /\bburuli ulcer\b/)) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A painless swelling or enlarging-ulcer pattern was reported.'],
    action: 'Arrange a prompt in-person medical examination; do not rely on cosmetic or over-the-counter skincare treatment.',
  };

  if (mentionsNamedPattern(normalized, /\b(?:ccca|central centrifugal cicatricial alopecia|akn|acne keloidalis nuchae)\b/)) return {
    level: 'dermatology', urgency: 'soon', reasons: ['A named hair or scalp condition was reported.'],
    action: 'Arrange a non-urgent dermatology or primary-care review for confirmation and treatment planning.',
  };

  const namedScabies = mentionsNamedPattern(normalized, /\bscabies\b/);
  const higherRiskScabiesContext = (
    (typeof input.profile.age === 'number' && input.profile.age < 2)
    || /\b(?:baby|infant|child under 2|under 2|crusted rash|crusted scabies|immunocompromised|weakened immune|suppressed immune)\b/.test(normalized)
  );
  if (namedScabies && higherRiskScabiesContext) return {
    level: 'primary-care', urgency: 'soon', reasons: ['A named contagious-itch condition and a higher-risk context were reported.'],
    action: 'Arrange clinician review before choosing treatment, and seek care sooner if infection or rapid worsening develops.',
  };

  if (namedScabies || mentionsNamedPattern(normalized, /\b(?:tinea versicolor|pityriasis versicolor)\b/)) return {
    level: 'pharmacist', urgency: 'soon', reasons: ['A named skin condition was reported.'],
    action: 'Ask a pharmacist or clinician to confirm the pattern before choosing treatment.',
  };

  if (input.barrier.state === 'compromised') return {
    level: 'primary-care', urgency: 'soon', reasons: ['Barrier assessment is compromised.', ...input.barrier.signals.slice(0, 3)],
    action: 'Pause treatment actives and arrange clinician or pharmacist review within a few days, sooner if worsening.',
  };

  const specialist = hits(normalized, specialistTerms);
  if (primaryId === 'scabies-like' && higherRiskScabiesContext) return {
    level: 'primary-care', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`, 'The reported context needs clinician review.'],
    action: 'Arrange clinician review before choosing treatment, and seek care sooner if infection or rapid worsening develops.',
  };

  const specialistPatterns = ['rosacea', 'psoriasis-like', 'hidradenitis-like', 'vitiligo-like', 'alopecia-areata-like', 'traction-alopecia-like', 'ccca-like', 'acne-keloidalis-nuchae-like'];
  const scalpFungalPattern = primaryId === 'tinea-corporis-like' && /\b(scalp|beard|nail)\b/.test(normalized);
  if (specialist.length || specialistPatterns.includes(primaryId ?? '') || scalpFungalPattern) return {
    level: 'dermatology', urgency: 'soon', reasons: specialist.length ? specialist.map(term => `Reported ${term}.`) : [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange a non-urgent dermatology or primary-care review for diagnostic confirmation and treatment planning.',
  };

  if (primaryId === 'atopic-dermatitis-like') return {
    level: 'primary-care', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Arrange a clinician or pharmacist review to confirm the pattern and choose treatment safely.',
  };

  if (['allergic-contact-dermatitis-like', 'tinea-corporis-like', 'tinea-versicolor-like', 'scabies-like'].includes(primaryId ?? '')) return {
    level: 'pharmacist', urgency: 'soon', reasons: [`The leading pattern is ${input.differential.primary?.label}.`],
    action: 'Ask a pharmacist or clinician to confirm the pattern before choosing treatment.',
  };

  if (input.profile.pregnant || input.profile.breastfeeding || input.findings.some(item => item.action === 'avoid')) return {
    level: 'pharmacist', urgency: 'soon', reasons: [input.profile.pregnant ? 'Pregnancy changes ingredient suitability.' : '', input.profile.breastfeeding ? 'Breastfeeding changes ingredient suitability.' : '', ...input.findings.filter(item => item.action === 'avoid').map(item => item.title)].filter(Boolean),
    action: 'Review the routine with a pharmacist or clinician before starting new treatment actives.',
  };

  if (input.differential.confidence === 'low') return {
    level: 'pharmacist', urgency: 'routine', reasons: ['The description does not yet support a confident working pattern.', ...input.differential.questions.slice(0, 2)],
    action: 'Self-care can remain simple, but a pharmacist review would improve pattern recognition before adding treatment.',
  };

  return {
    level: 'self-care', urgency: 'routine', reasons: ['No urgent escalation trigger was detected.', `The working pattern is ${input.differential.primary?.label ?? 'not yet specific'}.`],
    action: 'A conservative self-care routine with planned follow-up is reasonable. Escalate sooner if pain, infection, swelling or rapid spread develops.',
  };
}
