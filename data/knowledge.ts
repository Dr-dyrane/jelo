export type Concern = {
  slug: string;
  name: string;
  area: 'Face' | 'Scalp' | 'Hair' | 'Body';
  summary: string;
  signals: string[];
  ingredients: string[];
  productTerms: string[];
  escalation: string;
};

export const concerns: Concern[] = [
  { slug: 'acne-breakouts', name: 'Acne & breakouts', area: 'Face', summary: 'For blackheads, inflamed spots and recurring breakouts.', signals: ['blackheads', 'whiteheads', 'inflamed spots', 'oiliness'], ingredients: ['salicylic acid', 'azelaic acid', 'niacinamide'], productTerms: ['acne', 'blackheads', 'whiteheads', 'oiliness'], escalation: 'Seek clinical review for painful nodules, scarring, sudden severe acne or treatment-resistant disease.' },
  { slug: 'dark-spots', name: 'Dark spots', area: 'Face', summary: 'Care for post-acne marks and uneven tone.', signals: ['post-acne marks', 'uneven tone', 'melasma-like patches'], ingredients: ['tranexamic acid', 'niacinamide', 'azelaic acid', 'sunscreen'], productTerms: ['hyperpigmentation', 'dark spots'], escalation: 'Rapidly changing, irregular or bleeding pigmented lesions need in-person assessment.' },
  { slug: 'sensitive-barrier', name: 'Sensitive skin & barrier', area: 'Face', summary: 'Calm irritation. Rebuild comfort. Add actives slowly.', signals: ['stinging', 'tightness', 'flaking', 'reactivity'], ingredients: ['ceramides', 'panthenol', 'centella', 'glycerin'], productTerms: ['sensitivity', 'dryness', 'barrier'], escalation: 'Facial swelling, blistering, breathing difficulty or widespread rash requires urgent care.' },
  { slug: 'oily-congested-skin', name: 'Oily & congested skin', area: 'Face', summary: 'Manage shine and congestion without stripping skin.', signals: ['shine', 'enlarged pores', 'blackheads', 'rough texture'], ingredients: ['salicylic acid', 'niacinamide', 'lightweight sunscreen'], productTerms: ['oiliness', 'pores', 'blackheads', 'texture'], escalation: 'Persistent inflamed acne or scarring should be reviewed professionally.' },
  { slug: 'dandruff-itchy-scalp', name: 'Dandruff & itchy scalp', area: 'Scalp', summary: 'For flakes, itch and buildup.', signals: ['flakes', 'itch', 'greasy scale', 'scalp discomfort'], ingredients: ['anti-dandruff cleansing', 'gentle conditioning'], productTerms: ['dandruff', 'itch', 'dry scalp'], escalation: 'Hair loss, thick plaques, pus, pain or spreading rash needs clinical assessment.' },
  { slug: 'dry-frizzy-hair', name: 'Dry & frizzy hair', area: 'Hair', summary: 'Moisture and detangling for dry, frizzy hair.', signals: ['roughness', 'tangles', 'breakage', 'frizz'], ingredients: ['conditioning agents', 'argan oil', 'leave-in moisture'], productTerms: ['dry hair', 'tangles', 'frizz'], escalation: 'Sudden breakage or patchy hair loss should be assessed.' }
];

export const concernBySlug = (slug: string) => concerns.find(concern => concern.slug === slug);
