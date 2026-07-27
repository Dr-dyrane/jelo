import type { DifferentialAssessment } from './types';

export type OrdinaryCareConcernSlug =
  | 'daily-sun-protection'
  | 'sweat-body-odour'
  | 'dry-rough-body-skin'
  | 'dry-frizzy-hair'
  | 'dry-dehydrated-skin'
  | 'sensitive-barrier'
  | 'oily-congested-skin';

export type OrdinaryCareRoutineStep = {
  time: 'Morning' | 'Evening' | 'Any time';
  action: string;
};

export type OrdinaryCareIntent = {
  concernSlugs: OrdinaryCareConcernSlug[];
  labels: string[];
  routine: OrdinaryCareRoutineStep[];
};

type OrdinaryCareIntentDefinition = {
  concernSlug: OrdinaryCareConcernSlug;
  label: string;
  matches: (text: string) => boolean;
  routine: readonly OrdinaryCareRoutineStep[];
};

const hairContext = /\b(?:hair|frizz|frizzy|brittle|conditioner|shampoo|leave-in|hair mask)\b/;
const bodyContext = /\b(?:body|arms?|legs?|elbows?|knees?|hands?|feet|body lotion|body cream)\b/;
const dryContext = /\b(?:dry|dryness|rough|roughness|ashy|flaky|tight|dehydrated|moisturi[sz])\w*\b/;
const unresolvedSymptomContext = /\b(?:rash|pain|painful|sore|itch|itchy|burn|burning|sting|stinging|bleed|bleeding|blister|swelling|swollen|fever|wound|ooz\w*|pus|discharge|infection|hair loss|bald patch)\b/;
const unexplainedChangeContext = (
  /\b(?:sudden(?:ly)?|unexplained|new|changed?|different)\b.{0,32}\b(?:odou?r|smell|sweat\w*)\b/
);

export const ordinaryCareIntentDefinitions: readonly OrdinaryCareIntentDefinition[] = [
  {
    concernSlug: 'daily-sun-protection',
    label: 'Daily sun protection',
    matches: text => (
      /\b(?:sunscreen|sun screen|sun protection|spf)\b/.test(text)
      && !/\b(?:sunburn|burnt by the sun|burned by the sun)\b/.test(text)
    ),
    routine: [
      { time: 'Morning', action: 'Use a reviewed broad-spectrum sunscreen as directed on its label.' },
      { time: 'Any time', action: 'Reapply as directed, especially after sweating, swimming or towelling.' },
    ],
  },
  {
    concernSlug: 'sweat-body-odour',
    label: 'Sweat & body odour',
    matches: text => /\b(?:deodorant|anti-?perspirant|body odou?r|underarm odou?r|armpit odou?r)\b/.test(text),
    routine: [
      { time: 'Any time', action: 'Wash the underarms gently and dry them well.' },
      { time: 'Any time', action: 'Use a reviewed deodorant or antiperspirant as directed on clean, dry skin.' },
    ],
  },
  {
    concernSlug: 'dry-rough-body-skin',
    label: 'Dry & rough body skin',
    matches: text => (
      /\b(?:body lotion|body cream|body moisturiser|body moisturizer)\b/.test(text)
      || (bodyContext.test(text) && dryContext.test(text) && !hairContext.test(text))
    ),
    routine: [
      { time: 'Any time', action: 'After washing, pat the skin dry instead of rubbing it.' },
      { time: 'Any time', action: 'Apply a reviewed body moisturiser while the skin is still slightly damp.' },
    ],
  },
  {
    concernSlug: 'dry-frizzy-hair',
    label: 'Dry & frizzy hair',
    matches: text => (
      hairContext.test(text)
      && /\b(?:dry|frizz|frizzy|brittle|damaged|rough|conditioning|conditioner|hair mask)\b/.test(text)
    ),
    routine: [
      { time: 'Any time', action: 'Cleanse the scalp gently without rough handling through the hair lengths.' },
      { time: 'Any time', action: 'Use a reviewed conditioner as directed and detangle gently.' },
    ],
  },
  {
    concernSlug: 'dry-dehydrated-skin',
    label: 'Dry & dehydrated skin',
    matches: text => (
      dryContext.test(text)
      && !hairContext.test(text)
      && (
        /\b(?:face|facial|face skin)\b/.test(text)
        || (!bodyContext.test(text) && /\bskin\b/.test(text))
      )
    ),
    routine: [
      { time: 'Morning', action: 'Cleanse gently or rinse with lukewarm water, then apply a reviewed moisturiser.' },
      { time: 'Evening', action: 'Cleanse gently and finish with a reviewed moisturiser.' },
    ],
  },
  {
    concernSlug: 'sensitive-barrier',
    label: 'Sensitive skin & barrier',
    matches: text => /\b(?:sensitive skin|reactive skin|skin barrier|barrier care|gentle routine for sensitive|gentle product for sensitive)\b/.test(text),
    routine: [
      { time: 'Morning', action: 'Keep the routine short and use only reviewed gentle products.' },
      { time: 'Evening', action: 'Introduce one change at a time and stop a new product if discomfort persists.' },
    ],
  },
  {
    concernSlug: 'oily-congested-skin',
    label: 'Oily & congested skin',
    matches: text => /\b(?:oily skin|oily face|greasy skin|greasy face|shiny skin|face gets shiny|cleanser for oily)\b/.test(text),
    routine: [
      { time: 'Morning', action: 'Cleanse gently without scrubbing, then use a light moisturiser and sunscreen.' },
      { time: 'Evening', action: 'Cleanse gently and avoid stacking several new treatment products at once.' },
    ],
  },
] as const;

function normalizedText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hasDirectedDifferential(differential: DifferentialAssessment) {
  return Boolean(differential.primary && differential.confidence !== 'low');
}

export function assessOrdinaryCareIntent(
  text: string,
  differential?: DifferentialAssessment,
): OrdinaryCareIntent | undefined {
  if (differential && hasDirectedDifferential(differential)) return undefined;

  const normalized = normalizedText(text);
  if (
    unresolvedSymptomContext.test(normalized)
    || unexplainedChangeContext.test(normalized)
  ) {
    return undefined;
  }
  const matches = ordinaryCareIntentDefinitions.filter(definition => definition.matches(normalized));
  if (matches.length === 0) return undefined;

  const routine = Array.from(new Map(
    matches
      .flatMap(definition => definition.routine)
      .map(step => [`${step.time}:${step.action}`, step] as const),
  ).values());

  return {
    concernSlugs: matches.map(definition => definition.concernSlug),
    labels: matches.map(definition => definition.label),
    routine,
  };
}
