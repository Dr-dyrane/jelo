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
    id: 'acne-vulgaris', label: 'Acne-like breakout pattern',
    positives: [
      { terms: ['pimple', 'pimples', 'acne', 'breakout', 'whitehead', 'blackhead'], weight: 28, reason: 'Comedones or inflammatory breakouts were described.' },
      { terms: ['forehead', 'cheek', 'chin', 'jaw'], weight: 8, reason: 'The reported facial distribution is compatible with acne.' },
      { terms: ['oily', 'greasy', 'shine'], weight: 12, reason: 'Oiliness supports an acne pattern.' },
    ],
    negatives: [{ terms: ['itchy only', 'very itchy'], weight: 10, reason: 'Prominent itch without acne lesions can suggest another cause.' }],
    missing: ['Are there blackheads or whiteheads?', 'Are lesions painful, deep or leaving scars?', 'Which facial areas are involved?'],
  },
  {
    id: 'comedonal-acne', label: 'Clogged-pore acne-like pattern',
    positives: [
      { terms: ['blackhead', 'whitehead', 'clogged', 'tiny bumps', 'closed comedones'], weight: 38, reason: 'Non-inflammatory clogged pores were described.' },
      { terms: ['forehead', 'nose', 't-zone'], weight: 10, reason: 'The reported distribution is common for comedonal acne.' },
    ],
    negatives: [{ terms: ['pus', 'painful', 'deep cyst'], weight: 12, reason: 'Marked inflammation makes a purely comedonal pattern less likely.' }],
    missing: ['Are the bumps skin-coloured?', 'Is there redness or tenderness?', 'Do hair or occlusive products contact the area?'],
  },
  {
    id: 'irritant-contact-dermatitis', label: 'Irritant contact reaction pattern',
    positives: [
      { terms: ['burning', 'stinging', 'raw', 'over-exfoliated', 'after using', 'new product'], weight: 32, reason: 'Burning or a temporal relationship to product use supports irritation.' },
      { terms: ['dry', 'flaky', 'scaly', 'tight', 'peeling'], weight: 16, reason: 'Dryness and scaling support barrier injury.' },
      { terms: ['red', 'redness', 'irritated'], weight: 12, reason: 'Inflammation was described.' },
    ],
    negatives: [{ terms: ['blackhead', 'whitehead'], weight: 10, reason: 'Comedones point more strongly toward acne.' }],
    missing: ['Did this begin after a new product or increased frequency?', 'Does water or moisturizer sting?', 'Is the rash limited to product-contact areas?'],
  },
  {
    id: 'seborrhoeic-dermatitis', label: 'Seborrhoeic dermatitis-like pattern',
    positives: [
      { terms: ['dandruff', 'flaky scalp', 'itchy scalp'], weight: 34, reason: 'Scalp flaking and itch strongly support this pattern.' },
      { terms: ['eyebrow', 'sides of nose', 'nasolabial', 'behind ears'], weight: 18, reason: 'The described distribution is typical of seborrhoeic dermatitis.' },
      { terms: ['greasy scale', 'yellow scale', 'flaky face'], weight: 20, reason: 'Greasy or recurrent scale supports this pattern.' },
    ],
    missing: ['Is the scalp also affected?', 'Are flakes greasy or yellowish?', 'Does it recur around the nose, eyebrows or ears?'],
  },
  {
    id: 'post-inflammatory-hyperpigmentation', label: 'Post-inflammation pigment pattern',
    positives: [
      { terms: ['dark mark', 'dark marks', 'dark spot', 'after acne', 'post acne', 'pigmentation'], weight: 34, reason: 'Dark marks following inflammation were described.' },
      { terms: ['flat', 'not raised'], weight: 8, reason: 'Flat residual colour change supports pigmentation rather than active lesions.' },
    ],
    negatives: [{ terms: ['rapidly changing', 'bleeding'], weight: 20, reason: 'Rapid change or bleeding requires another pathway.' }],
    missing: ['Are the marks flat?', 'Did each mark follow a pimple or rash?', 'Are new inflamed lesions still appearing?'],
  },
  {
    id: 'melasma', label: 'Melasma-like pigmentation pattern',
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
    id: 'xerosis', label: 'Dry-skin pattern',
    positives: [
      { terms: ['dry', 'flaky', 'ashy', 'scaly', 'tight'], weight: 28, reason: 'Dryness, scale or tightness was described.' },
      { terms: ['after washing', 'hot water', 'harmattan', 'winter'], weight: 10, reason: 'Environmental or cleansing triggers support xerosis.' },
    ],
    negatives: [{ terms: ['oozing', 'pus', 'blister'], weight: 18, reason: 'Oozing, pus or blistering suggests more than simple dryness.' }],
    missing: ['Does moisturizer relieve the tightness?', 'Is there cracking, bleeding or severe itch?', 'What cleanser and water temperature are used?'],
  },
  {
    id: 'atopic-dermatitis-like', label: 'Atopic eczema-like pattern',
    positives: [
      { terms: ['very itchy', 'intense itch', 'itchy dry patches', 'eczema'], weight: 34, reason: 'Prominent itch with dry patches supports an eczema-like pattern.' },
      { terms: ['elbow folds', 'behind knees', 'neck folds', 'recurrent flares'], weight: 20, reason: 'The reported distribution or recurrence can fit atopic eczema.' },
      { terms: ['cracked', 'weeping', 'thickened skin'], weight: 14, reason: 'Cracking, weeping or thickening can accompany an eczema flare.' },
    ],
    negatives: [{ terms: ['ring shaped', 'central clearing'], weight: 18, reason: 'A ring-shaped spreading edge can point toward a fungal rash instead.' }],
    missing: ['Is itch the main symptom?', 'Does it recur in skin folds?', 'Is there warmth, pain, crusting, fluid or fever?'],
  },
  {
    id: 'allergic-contact-dermatitis-like', label: 'Allergic contact reaction pattern',
    positives: [
      { terms: ['very itchy rash', 'itchy blisters', 'blistering where', 'allergic reaction'], weight: 38, reason: 'Marked itch or blistering at a contact site supports an allergic reaction pattern.' },
      { terms: ['hair dye', 'fragrance', 'adhesive', 'jewelry', 'jewellery', 'gloves'], weight: 18, reason: 'A common contact trigger was described.' },
      { terms: ['exactly where', 'contact area', 'after touching'], weight: 18, reason: 'A contact-limited distribution supports this pattern.' },
    ],
    missing: ['What touched the area before the rash began?', 'Is the rash limited to the contact area?', 'Are there blisters, swelling or breathing symptoms?'],
  },
  {
    id: 'psoriasis-like', label: 'Psoriasis-like plaque pattern',
    positives: [
      { terms: ['thick plaques', 'silvery scale', 'well defined plaques', 'psoriasis'], weight: 42, reason: 'Thick, sharply defined scaly plaques support a psoriasis-like pattern.' },
      { terms: ['elbows', 'knees', 'lower back', 'scalp plaques'], weight: 18, reason: 'The reported distribution can fit psoriasis.' },
      { terms: ['nail pits', 'nail changes', 'swollen joints'], weight: 20, reason: 'Nail or joint changes are relevant associated features.' },
    ],
    missing: ['Are patches thick and sharply defined?', 'Are the scalp or nails involved?', 'Is there joint pain, stiffness or swelling?'],
  },
  {
    id: 'tinea-corporis-like', label: 'Ringworm-like pattern',
    positives: [
      { terms: ['ring shaped', 'ring-shaped', 'circular scaly', 'ringworm'], weight: 42, reason: 'A ring-shaped scaly patch supports a fungal-rash pattern.' },
      { terms: ['spreading edge', 'raised border', 'central clearing'], weight: 24, reason: 'An advancing border or central clearing is compatible with ringworm.' },
      { terms: ['itchy patch', 'spreading patch'], weight: 10, reason: 'An itchy spreading patch adds support.' },
    ],
    missing: ['Does the patch have a raised or spreading edge?', 'Is the scalp, beard or nail involved?', 'Has anyone close to you or a pet had a similar rash?'],
  },
  {
    id: 'pseudofolliculitis-like', label: 'Ingrown-hair or razor-bump pattern',
    positives: [
      { terms: ['ingrown hair', 'ingrown hairs', 'razor bumps', 'trapped hair'], weight: 44, reason: 'Ingrown hairs or razor bumps were directly described.' },
      { terms: ['after shaving', 'after waxing', 'beard line', 'bikini line'], weight: 20, reason: 'Hair removal and the reported distribution support this pattern.' },
      { terms: ['curly hair', 'coarse hair'], weight: 8, reason: 'Curved or coarse hair can increase ingrown-hair risk.' },
    ],
    missing: ['Can you see a trapped or curved hair?', 'Did this begin after shaving or waxing?', 'Is there spreading warmth, severe pain or fever?'],
  },
  {
    id: 'hidradenitis-like', label: 'Recurring deep-lump pattern',
    positives: [
      { terms: ['recurrent deep lumps', 'recurring deep lumps', 'painful boils', 'hidradenitis'], weight: 46, reason: 'Recurring deep painful lumps support a hidradenitis-like pattern.' },
      { terms: ['armpit', 'armpits', 'groin', 'under breast', 'skin folds'], weight: 22, reason: 'The reported skin-fold distribution is characteristic of this pattern.' },
      { terms: ['tunnels', 'drainage', 'repeated scars'], weight: 22, reason: 'Drainage, tunnels or scarring make early clinical review important.' },
    ],
    missing: ['Do lumps recur in the same skin-fold areas?', 'Do they drain or leave scars?', 'Is there fever, spreading redness or severe pain?'],
  },
  {
    id: 'vitiligo-like', label: 'Loss-of-colour pattern',
    positives: [
      { terms: ['loss of skin colour', 'loss of skin color', 'depigmented patches', 'vitiligo'], weight: 44, reason: 'Loss of skin colour was directly described.' },
      { terms: ['white patches', 'milky white', 'hair turned white'], weight: 24, reason: 'White patches or local hair-colour change support this pattern.' },
      { terms: ['no scale', 'not itchy', 'smooth patch'], weight: 10, reason: 'A smooth patch without scale can fit pigment loss.' },
    ],
    missing: ['Are patches completely white or only lighter?', 'Is there scale, itch or numbness?', 'Are the patches spreading or is hair in them changing colour?'],
  },
  {
    id: 'alopecia-areata-like', label: 'Patchy hair-loss pattern',
    positives: [
      { terms: ['smooth bald patch', 'smooth bald patches', 'round bald patch', 'patchy hair loss'], weight: 46, reason: 'A smooth, discrete patch of hair loss was described.' },
      { terms: ['eyebrow loss', 'eyelash loss', 'exclamation mark hairs'], weight: 22, reason: 'Loss in other hair-bearing areas or characteristic short hairs adds support.' },
      { terms: ['sudden hair loss', 'suddenly fell out'], weight: 14, reason: 'Sudden onset makes prompt cause-finding important.' },
    ],
    missing: ['Is the exposed skin smooth, scaly or scarred?', 'Was the loss sudden?', 'Are brows, lashes or nails affected?'],
  },
  {
    id: 'traction-alopecia-like', label: 'Tension-related hair-loss pattern',
    positives: [
      { terms: ['tight braids', 'tight weave', 'tight ponytail', 'painful hairstyle'], weight: 40, reason: 'Repeated tension from a tight style was described.' },
      { terms: ['hairline thinning', 'broken hairs at hairline', 'edges thinning'], weight: 28, reason: 'Hairline thinning or breakage supports traction-related loss.' },
      { terms: ['scalp bumps after braids', 'tender scalp after braids'], weight: 14, reason: 'Pain or bumps after styling indicate damaging tension.' },
    ],
    missing: ['Which styles place tension on the area?', 'Does styling hurt or cause bumps?', 'Is the skin smooth, shiny or scarred?'],
  },
  {
    id: 'keratosis-pilaris-like', label: 'Rough follicular-bump pattern',
    positives: [
      { terms: ['rough tiny bumps', 'chicken skin', 'keratosis pilaris'], weight: 44, reason: 'Small rough follicular bumps support a keratosis-pilaris-like pattern.' },
      { terms: ['upper arms', 'front of thighs', 'outer thighs', 'cheeks and arms'], weight: 22, reason: 'The reported distribution is common for this pattern.' },
      { terms: ['not painful', 'worse when dry'], weight: 8, reason: 'A painless pattern that worsens with dryness adds support.' },
    ],
    missing: ['Are the bumps rough but not painful?', 'Are they mainly on upper arms or thighs?', 'Is there pus, warmth or rapid spread?'],
  },
  {
    id: 'miliaria-like', label: 'Heat-rash-like pattern',
    positives: [
      { terms: ['prickly bumps', 'prickly rash', 'heat rash', 'sweat rash'], weight: 42, reason: 'A prickly rash associated with heat or sweat was described.' },
      { terms: ['after sweating', 'hot weather', 'under tight clothing'], weight: 22, reason: 'Heat, sweat or occlusion supports this pattern.' },
      { terms: ['small raised spots', 'tiny itchy spots'], weight: 10, reason: 'Small itchy raised spots add support.' },
    ],
    missing: ['Did this begin after heat or heavy sweating?', 'Does cooling the skin help?', 'Is there fever, pain, pus or rapid spread?'],
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
