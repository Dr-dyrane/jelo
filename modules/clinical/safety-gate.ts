import type { PatientProfile, ReferralAssessment } from './core/types';

const emergencyPatterns = [
  { pattern: /\b(?:difficulty|trouble)\s+(?:with\s+)?breathing\b|\b(?:difficult|hard|very\s+hard)\s+to\s+breathe\b|\bshort(?:ness)?\s+of\s+breath\b|\b(?:cannot|can't|cant|unable to|struggling to)\s+breathe\b/i, label: 'breathing difficulty' },
  { pattern: /\b(?:difficulty|trouble)\s+(?:with\s+)?swallowing\b|\b(?:difficult|hard|very\s+hard)\s+to\s+swallow\b|\b(?:cannot|can't|cant|unable to)\s+swallow\b/i, label: 'difficulty swallowing' },
  { pattern: /\b(?:swollen\s+(?:tongue|throat)|(?:tongue|throat)\s+(?:is\s+)?swollen|(?:tongue|throat)\s+swelling|swelling\s+(?:of|in)\s+(?:the\s+)?(?:tongue|throat))\b/i, label: 'tongue or throat swelling' },
  { pattern: /\b(?:fainting|fainted|passed out|anaphylaxis)\b/i, label: 'possible severe allergic reaction' },
];

const urgentPatterns = [
  { pattern: /\b(?:swollen\s+(?:face|lips?)|(?:face|lips?)\s+(?:is\s+|are\s+)?swollen|facial\s+swelling|lips?\s+swelling|swelling\s+(?:of|around)\s+(?:the\s+)?(?:face|lips?))\b/i, label: 'facial swelling' },
  { pattern: /\b(?:eyes?\s+pain|painful\s+eyes?|swollen\s+eyes?|eyes?\s+(?:is\s+|are\s+)?swollen|eyes?\s+swelling|(?:suddenly\s+)?blurred\s+vision|vision\s+(?:is\s+)?(?:suddenly\s+)?blurred|sudden\s+vision\s+(?:change|changes|loss)|light\s+sensitivity|red\s+eye)\b/i, label: 'eye involvement' },
  { pattern: /\b(?:(?:rapidly|quickly|fast)\s+(?:spreading|worsening)|spread(?:ing)?\s+(?:rapidly|quickly))\b/i, label: 'rapid spread' },
  { pattern: /\b(?:fever|chills)\b/i, label: 'fever or chills' },
  { pattern: /\b(?:blistering|widespread\s+blisters?|multiple\s+blisters?|skin\b[^.;]{0,32}\b(?:is|are)\s+peeling|peeling\s+skin)\b/i, label: 'blistering or skin peeling' },
  { pattern: /\bsevere\s+pain\b/i, label: 'severe pain' },
  { pattern: /\b(?:pus\b.*\bfever|fever\b.*\bpus)\b/i, label: 'possible infection' },
];

const clinicianReviewPatterns = [
  { pattern: /pregnan/i, label: 'pregnancy' },
  { pattern: /breast ?feed|nursing/i, label: 'breastfeeding' },
  { pattern: /\b(?:infant|newborn|baby|babies|toddler|child|children|kid|kids|minor)\b/i, label: 'person under 18' },
  { pattern: /\b(?:[0-9]|1[0-7])\s*(?:-?\s*years?\s*-?\s*old|y\/?o)\b/i, label: 'person under 18' },
];

export type SafetyInput = { symptoms: string[] };

function matches(text: string, patterns: Array<{ pattern: RegExp; label: string }>) {
  return patterns.filter(item => {
    if (!item.pattern.test(text)) return false;
    if (item.label === 'fever or chills') {
      const hasFever = /\bfever\b/i.test(text) && !/\b(?:no|without|not having|do not have|don't have)\s+(?:a\s+)?fever\b/i.test(text);
      const hasChills = /\bchills\b/i.test(text) && !/\b(?:no|without|not having|do not have|don't have)\s+chills\b/i.test(text);
      return hasFever || hasChills;
    }
    if (item.label === 'blistering or skin peeling') {
      const hasBlistering = /\b(?:blistering|widespread\s+blisters?|multiple\s+blisters?)\b/i.test(text)
        && !/\b(?:no|without)\b[^.;]{0,28}\b(?:blistering|widespread\s+blisters?|multiple\s+blisters?)\b/i.test(text);
      const hasPeeling = /\b(?:skin\b[^.;]{0,32}\b(?:is|are)\s+peeling|peeling\s+skin)\b/i.test(text)
        && !/\b(?:no|without)\s+(?:signs?\s+of\s+)?(?:skin\b[^.;]{0,16}\b(?:is|are)\s+peeling|peeling\s+skin)\b/i.test(text);
      const toeWebPeeling = /\b(?:between\s+(?:my|the)\s+toes|toe[- ]web|athlete'?s foot|tinea pedis)\b/i.test(text);
      const widespreadPeeling = /\b(?:widespread|all over|across (?:my|the) body|whole body|large areas?)\b/i.test(text);
      return hasBlistering || (hasPeeling && (!toeWebPeeling || widespreadPeeling));
    }
    return true;
  }).map(item => item.label);
}

export function assessRedFlags(input: SafetyInput) {
  const text = input.symptoms.join(' ');
  const emergency = matches(text, emergencyPatterns);
  if (emergency.length) return {
    level: 'emergency',
    matchedSignals: emergency,
    instruction: 'Seek emergency care now. Do not rely on skincare guidance.',
  } as const;

  const urgent = matches(text, urgentPatterns);
  if (urgent.length) return {
    level: 'urgent',
    matchedSignals: urgent,
    instruction: 'Arrange same-day in-person medical assessment.',
  } as const;

  const clinicianReview = matches(text, clinicianReviewPatterns);
  if (clinicianReview.length) return {
    level: 'clinician-review',
    matchedSignals: clinicianReview,
    instruction: 'Review this with a pharmacist or clinician before choosing treatment products.',
  } as const;

  return {
    level: 'self-care-eligible',
    matchedSignals: [],
    instruction: 'Conservative educational guidance can continue.',
  } as const;
}

export function assessConsultSafety(input: {
  text: string;
  profile: PatientProfile;
  referral: ReferralAssessment;
}) {
  const unsupportedContext = [
    input.profile.allergies?.length ? 'allergies were provided' : '',
    input.profile.medications?.length ? 'medications were provided' : '',
  ].filter(Boolean);
  const profileSignals = [
    input.profile.pregnant ? 'pregnant' : '',
    input.profile.breastfeeding ? 'breastfeeding' : '',
    typeof input.profile.age === 'number' && input.profile.age < 18 ? 'minor' : '',
  ].filter(Boolean);
  const redFlags = assessRedFlags({ symptoms: [input.text, ...profileSignals] });
  const referralLevel = input.referral.level;
  const urgentReferral = referralLevel === 'urgent' || referralLevel === 'emergency';
  const directedReferral = referralLevel !== 'self-care' && input.referral.urgency !== 'routine';
  const stopJourney = redFlags.level !== 'self-care-eligible' || urgentReferral || directedReferral || unsupportedContext.length > 0;
  const allowProducts = !stopJourney && redFlags.level === 'self-care-eligible' && referralLevel === 'self-care';

  const level = redFlags.level === 'emergency' || referralLevel === 'emergency'
    ? 'emergency'
    : redFlags.level === 'urgent' || referralLevel === 'urgent'
      ? 'urgent'
      : redFlags.level === 'clinician-review' || referralLevel !== 'self-care' || unsupportedContext.length > 0
        ? 'clinician-review'
        : 'self-care-eligible';

  const action = referralLevel === 'emergency'
    ? input.referral.action
    : redFlags.level === 'emergency'
      ? redFlags.instruction
      : referralLevel === 'urgent'
      ? input.referral.action
      : redFlags.level === 'urgent'
        ? redFlags.instruction
      : directedReferral
        ? input.referral.action
      : unsupportedContext.length
        ? 'JeloCare does not check allergies or medicine interactions. Review these details with a pharmacist or clinician before choosing treatment products.'
        : redFlags.level === 'clinician-review'
          ? redFlags.instruction
          : referralLevel !== 'self-care'
            ? input.referral.action
            : redFlags.instruction;

  return {
    level,
    stopJourney,
    allowModel: !stopJourney,
    allowProducts,
    reasons: Array.from(new Set([...redFlags.matchedSignals, ...unsupportedContext, ...input.referral.reasons])),
    action,
  } as const;
}
