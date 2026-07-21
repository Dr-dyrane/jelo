import type { DifferentialAssessment, DifferentialPattern, PatientProfile } from './types';

type PatternRule = {
  id: string;
  label: string;
  positives: { terms: string[]; weight: number; reason: string }[];
  negatives?: { terms: string[]; weight: number; reason: string }[];
  missing: string[];
};

const rules: PatternRule[] = [
  {
    id: 'acne-vulgaris', label: 'Acne vulgaris',
    positives: [
      { terms: ['pimple', 'pimples', 'acne', 'breakout', 'whitehead', 'blackhead'], weight: 28, reason: 'Comedones or inflammatory breakouts were described.' },
      { terms: ['forehead', 'cheek', 'chin', 'jaw'], weight: 8, reason: 'The reported facial distribution is compatible with acne.' },
      { terms: ['oily', 'greasy', 'shine'], weight: 12, reason: 'Oiliness supports an acne pattern.' },
    ],
    negatives: [{ terms: ['itchy only', 'very itchy'], weight: 10, reason: 'Prominent itch without acne lesions can suggest another cause.' }],
    missing: ['Are there blackheads or whiteheads?', 'Are lesions painful, deep or leaving scars?', 'Which facial areas are involved?'],
  },
  {
    id: 'comedonal-acne', label: 'Comedonal acne',
    positives: [
      { terms: ['blackhead', 'whitehead', 'clogged', 'tiny bumps', 'closed comedones'], weight: 38, reason: 'Non-inflammatory clogged pores were described.' },
      { terms: ['forehead', 'nose', 't-zone'], weight: 10, reason: 'The reported distribution is common for comedonal acne.' },
    ],
    negatives: [{ terms: ['pus', 'painful', 'deep cyst'], weight: 12, reason: 'Marked inflammation makes a purely comedonal pattern less likely.' }],
    missing: ['Are the bumps skin-coloured?', 'Is there redness or tenderness?', 'Do hair or occlusive products contact the area?'],
  },
  {
    id: 'irritant-contact-dermatitis', label: 'Irritant contact dermatitis',
    positives: [
      { terms: ['burning', 'stinging', 'raw', 'over-exfoliated', 'after using', 'new product'], weight: 32, reason: 'Burning or a temporal relationship to product use supports irritation.' },
      { terms: ['dry', 'flaky', 'scaly', 'tight', 'peeling'], weight: 16, reason: 'Dryness and scaling support barrier injury.' },
      { terms: ['red', 'redness', 'irritated'], weight: 12, reason: 'Inflammation was described.' },
    ],
    negatives: [{ terms: ['blackhead', 'whitehead'], weight: 10, reason: 'Comedones point more strongly toward acne.' }],
    missing: ['Did this begin after a new product or increased frequency?', 'Does water or moisturizer sting?', 'Is the rash limited to product-contact areas?'],
  },
  {
    id: 'seborrhoeic-dermatitis', label: 'Seborrhoeic dermatitis',
    positives: [
      { terms: ['dandruff', 'flaky scalp', 'itchy scalp'], weight: 34, reason: 'Scalp flaking and itch strongly support this pattern.' },
      { terms: ['eyebrow', 'sides of nose', 'nasolabial', 'behind ears'], weight: 18, reason: 'The described distribution is typical of seborrhoeic dermatitis.' },
      { terms: ['greasy scale', 'yellow scale', 'flaky face'], weight: 20, reason: 'Greasy or recurrent scale supports this pattern.' },
    ],
    missing: ['Is the scalp also affected?', 'Are flakes greasy or yellowish?', 'Does it recur around the nose, eyebrows or ears?'],
  },
  {
    id: 'post-inflammatory-hyperpigmentation', label: 'Post-inflammatory hyperpigmentation',
    positives: [
      { terms: ['dark mark', 'dark marks', 'dark spot', 'after acne', 'post acne', 'pigmentation'], weight: 34, reason: 'Dark marks following inflammation were described.' },
      { terms: ['flat', 'not raised'], weight: 8, reason: 'Flat residual colour change supports pigmentation rather than active lesions.' },
    ],
    negatives: [{ terms: ['rapidly changing', 'bleeding'], weight: 20, reason: 'Rapid change or bleeding requires another pathway.' }],
    missing: ['Are the marks flat?', 'Did each mark follow a pimple or rash?', 'Are new inflamed lesions still appearing?'],
  },
  {
    id: 'melasma', label: 'Melasma',
    positives: [
      { terms: ['melasma', 'symmetrical patches', 'brown patches', 'upper lip', 'cheeks', 'forehead'], weight: 24, reason: 'Symmetrical facial pigmentation in typical areas supports melasma.' },
      { terms: ['pregnant', 'pregnancy', 'hormonal', 'sun'], weight: 12, reason: 'Hormonal or UV association supports melasma.' },
    ],
    missing: ['Are patches symmetrical?', 'Did pregnancy, hormones or sun exposure precede them?', 'Are the patches flat and non-itchy?'],
  },
  {
    id: 'rosacea', label: 'Rosacea-like pattern',
    positives: [
      { terms: ['flushing', 'flush', 'persistent redness', 'visible veins'], weight: 34, reason: 'Flushing or persistent central redness supports a rosacea-like pattern.' },
      { terms: ['heat', 'spicy food', 'alcohol', 'sun trigger'], weight: 12, reason: 'Common flushing triggers were described.' },
      { terms: ['burning', 'stinging'], weight: 8, reason: 'Facial sensitivity can accompany rosacea.' },
    ],
    negatives: [{ terms: ['blackhead', 'whitehead'], weight: 16, reason: 'Comedones are not typical of rosacea.' }],
    missing: ['Does the redness flush with heat or spicy food?', 'Are there visible small blood vessels?', 'Are the eyes gritty or irritated?'],
  },
  {
    id: 'folliculitis', label: 'Folliculitis-like pattern',
    positives: [
      { terms: ['same size bumps', 'uniform bumps', 'hair follicle', 'after shaving', 'itchy bumps', 'pus bumps'], weight: 30, reason: 'Uniform follicle-centred bumps support folliculitis.' },
      { terms: ['chest', 'back', 'beard', 'scalp'], weight: 8, reason: 'The reported location can fit folliculitis.' },
    ],
    missing: ['Are the bumps all similar in size?', 'Are they centred on hairs?', 'Did shaving, sweating or occlusion precede them?'],
  },
  {
    id: 'xerosis', label: 'Xerosis / dry-skin pattern',
    positives: [
      { terms: ['dry', 'flaky', 'ashy', 'scaly', 'tight'], weight: 28, reason: 'Dryness, scale or tightness was described.' },
      { terms: ['after washing', 'hot water', 'harmattan', 'winter'], weight: 10, reason: 'Environmental or cleansing triggers support xerosis.' },
    ],
    negatives: [{ terms: ['oozing', 'pus', 'blister'], weight: 18, reason: 'Oozing, pus or blistering suggests more than simple dryness.' }],
    missing: ['Does moisturizer relieve the tightness?', 'Is there cracking, bleeding or severe itch?', 'What cleanser and water temperature are used?'],
  },
];

function includesAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term));
}

export function assessDifferential(text: string, profile: PatientProfile): DifferentialAssessment {
  const normalized = text.toLowerCase();
  const scored: DifferentialPattern[] = rules.map(rule => {
    const supporting: string[] = [];
    const opposing: string[] = [];
    let score = 0;
    for (const item of rule.positives) if (includesAny(normalized, item.terms)) { score += item.weight; supporting.push(item.reason); }
    for (const item of rule.negatives ?? []) if (includesAny(normalized, item.terms)) { score -= item.weight; opposing.push(item.reason); }
    if (profile.sensitiveSkin && ['irritant-contact-dermatitis', 'rosacea'].includes(rule.id)) score += 6;
    return { id: rule.id, label: rule.label, confidence: Math.max(0, Math.min(92, score)), supporting, opposing, missing: rule.missing };
  }).filter(item => item.confidence >= 12).sort((a, b) => b.confidence - a.confidence);

  const primary = scored[0];
  const alternatives = scored.slice(1, 4);
  const confidence = !primary || primary.confidence < 30 ? 'low' : primary.confidence >= 60 && primary.supporting.length >= 2 ? 'high' : 'moderate';
  const questions = Array.from(new Set([...(primary?.missing ?? []), ...alternatives.flatMap(item => item.missing.slice(0, 1))])).slice(0, 5);
  return { primary, alternatives, confidence, questions };
}
