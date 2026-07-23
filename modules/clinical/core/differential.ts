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
    id: 'tinea-capitis-like', label: 'Scalp fungal-infection pattern',
    positives: [
      { terms: ['tinea capitis', 'scalp ringworm', 'ringworm on my scalp', 'ringworm on the scalp'], weight: 56, reason: 'A named scalp fungal condition was reported and needs in-person confirmation.' },
      { terms: ['scaly scalp with broken hairs', 'broken hairs and scale', 'black dots and scale', 'scalp scale and hair loss', 'scaly patchy hair loss'], weight: 48, reason: 'Scalp scale with broken hairs or hair loss supports this pattern.' },
      { terms: ['scaly scalp patch', 'scalp scaling', 'crusted scalp patch'], weight: 30, reason: 'A scaly or crusted scalp patch adds support.' },
      { terms: ['broken hairs', 'black dots'], weight: 26, reason: 'Broken hairs or black dots within a scalp patch add support.' },
      { terms: ['patchy hair loss', 'patch of hair loss', 'bald patch'], weight: 18, reason: 'Patchy hair loss can occur when scalp hair is affected.' },
      { terms: ['itchy scaly scalp', 'tender swollen scalp patch', 'boggy scalp swelling'], weight: 22, reason: 'Scalp itch, scale or a tender swollen patch adds support.' },
    ],
    negatives: [
      { terms: ['smooth bald patch', 'no scale'], weight: 28, reason: 'A smooth patch without scale supports another hair-loss pathway.' },
      { terms: ['tight braids', 'edges thinning'], weight: 20, reason: 'Tension at the hairline supports traction-related loss instead.' },
    ],
    missing: ['Is the exposed scalp scaly, crusted or swollen?', 'Are hairs broken or reduced to black dots?', 'Is anyone close to you or a pet affected?'],
  },
  {
    id: 'tinea-versicolor-like', label: 'Light-or-dark scaly-patch pattern',
    positives: [
      { terms: ['tinea versicolor', 'pityriasis versicolor', 'lighter fine scaly patches', 'light scaly patches', 'dark scaly patches'], weight: 42, reason: 'Fine-scaled lighter or darker patches support this pattern.' },
      { terms: ['fine scale', 'fine scaly', 'powdery scale'], weight: 20, reason: 'Fine surface scale helps distinguish this pattern from simple colour loss.' },
      { terms: ['hot humid', 'warm humid', 'humid weather', 'returns in summer'], weight: 20, reason: 'Warm, humid recurrence supports this pattern.' },
      { terms: ['chest', 'upper back', 'shoulders', 'neck'], weight: 8, reason: 'The reported distribution can fit this pattern.' },
    ],
    negatives: [
      { terms: ['ring shaped', 'ring-shaped', 'central clearing'], weight: 22, reason: 'A ring with central clearing suggests a different fungal-rash pattern.' },
      { terms: ['milky white', 'no scale'], weight: 18, reason: 'Complete colour loss without scale needs a different assessment.' },
    ],
    missing: ['Is there a fine surface scale?', 'Are patches lighter or darker than nearby skin?', 'Do they recur in warm, humid weather?'],
  },
  {
    id: 'cellulitis-like', label: 'Hot, painful swelling pattern',
    positives: [
      { terms: ['cellulitis'], weight: 56, reason: 'A named skin infection was reported and needs urgent confirmation.' },
      { terms: ['hot and swollen', 'warm and swollen', 'painful swelling', 'warmth and swelling'], weight: 48, reason: 'Pain, heat and swelling together require an urgent infection assessment.' },
      { terms: ['spreading colour change', 'spreading color change', 'skin is tender', 'skin feels tender'], weight: 18, reason: 'Tenderness or a spreading colour change adds concern without relying on redness.' },
      { terms: ['feeling unwell', 'flu-like symptoms', 'swollen painful glands'], weight: 18, reason: 'Feeling unwell alongside skin changes increases concern.' },
    ],
    negatives: [{ terms: ['not painful', 'not warm', 'not swollen'], weight: 28, reason: 'The absence of pain, heat or swelling makes this urgent pattern less specific.' }],
    missing: ['Is the area painful, hot and swollen?', 'Is it spreading or blistering?', 'Do you feel feverish, shaky, dizzy or confused?'],
  },
  {
    id: 'impetigo-like', label: 'Crusted spreading-sore pattern',
    positives: [
      { terms: ['impetigo'], weight: 56, reason: 'A named contagious skin infection was reported and needs confirmation.' },
      { terms: ['golden-brown crust', 'golden brown crust', 'dark crusts', 'crusty golden-brown patches'], weight: 46, reason: 'Golden-brown or dark crusts after a sore or blister support this pattern.' },
      { terms: ['sores burst', 'blisters burst', 'oozing sores', 'spreading crusts'], weight: 28, reason: 'Bursting, oozing or spreading sores add support.' },
      { terms: ['around my nose', 'around the nose', 'around my mouth', 'around the mouth', 'on my hands'], weight: 10, reason: 'The reported location can fit this pattern.' },
    ],
    negatives: [{ terms: ['one small pustule', 'one pimple', 'not spreading'], weight: 30, reason: 'One localized spot without spread is less specific for this pattern.' }],
    missing: ['Did sores or blisters burst before the crust appeared?', 'Are the crusts spreading or oozing?', 'Is this affecting a baby, the breast while breastfeeding, or someone with weakened immunity?'],
  },
  {
    id: 'shingles-like', label: 'One-sided painful-blister pattern',
    positives: [
      { terms: ['shingles'], weight: 56, reason: 'A named painful blistering condition was reported and needs prompt confirmation.' },
      { terms: ['clustered blisters', 'cluster of blisters', 'blisters in a cluster', 'blisters in a band', 'band of blisters', 'stripe of blisters'], weight: 34, reason: 'A cluster or band of blisters supports this pattern.' },
      { terms: ['one-sided', 'one sided', 'on one side', 'one side of my body', 'one side of the body', 'one side of my face', 'only on one side'], weight: 28, reason: 'A one-sided distribution adds support.' },
      { terms: ['pain and tingling', 'pain or tingling', 'tingling before the rash', 'pain before the rash'], weight: 22, reason: 'Pain or tingling before a rash is compatible with this pattern.' },
    ],
    negatives: [{ terms: ['both sides', 'all over my body', 'where the product touched'], weight: 32, reason: 'A bilateral, widespread or contact-limited rash supports a different pathway.' }],
    missing: ['Did pain or tingling begin before the rash?', 'Are the blisters clustered on only one side?', 'Is the eye, nose, face, ear or breast involved?'],
  },
  {
    id: 'mpox-like', label: 'Mpox-compatible lesion pattern',
    positives: [
      { terms: ['mpox', 'monkeypox'], weight: 58, reason: 'A named infectious condition was reported and needs testing and clinical confirmation.' },
      { terms: ['firm painful lesions', 'painful firm lesions', 'painful lesions that blister', 'lesions became blisters', 'lesions that crust'], weight: 40, reason: 'Evolving firm or painful lesions support an infectious-lesion assessment.' },
      { terms: ['swollen lymph nodes', 'swollen glands'], weight: 24, reason: 'Swollen lymph nodes can accompany this lesion pattern.' },
      { terms: ['fever and body aches', 'fever and headache', 'headache and muscle aches', 'fever with low energy'], weight: 16, reason: 'Associated systemic symptoms add concern.' },
      { terms: ['close contact with mpox', 'shared bedding with', 'shared towels with'], weight: 22, reason: 'Recent close contact or contaminated personal items can be relevant.' },
    ],
    negatives: [{ terms: ['one friction blister', 'one pimple', 'no other symptoms'], weight: 30, reason: 'One ordinary localized lesion without other symptoms is not specific.' }],
    missing: ['Are lesions firm, painful or changing from bumps to blisters or crusts?', 'Are there swollen glands, fever, headache or body aches?', 'Has there been close contact with someone with a similar rash?'],
  },
  {
    id: 'severe-medicine-reaction-like', label: 'Severe medicine-reaction warning pattern',
    positives: [
      { terms: ['sjs', 'stevens-johnson syndrome', 'stevens johnson syndrome', 'toxic epidermal necrolysis'], weight: 70, reason: 'A named medical emergency was reported.' },
      { terms: ['rash after starting a new medicine', 'rash after a new medicine', 'rash after taking antibiotics', 'rash after taking a painkiller'], weight: 38, reason: 'A rash beginning after a medicine needs medicine-reaction assessment.' },
      { terms: ['circular target-like patches', 'target-like rash', 'darker in the middle'], weight: 34, reason: 'Target-like circular patches can be a warning sign.' },
      { terms: ['medicine rash with blisters', 'medicine rash with peeling', 'mouth sores after medicine', 'eye sores after medicine'], weight: 42, reason: 'Blistering, peeling or mucosal sores after a medicine are emergency warning signs.' },
    ],
    missing: ['Did this begin after starting a medicine?', 'Is the rash spreading, painful, blistering or peeling?', 'Are the mouth, eyes, throat or genitals sore or blistered?'],
  },
  {
    id: 'painless-ulcer-like', label: 'Painless enlarging-ulcer pattern',
    positives: [
      { terms: ['buruli ulcer'], weight: 60, reason: 'A named ulcer-forming infection was reported and needs clinical confirmation.' },
      { terms: ['painless swelling', 'painless firm patch', 'painless plaque'], weight: 38, reason: 'A painless swelling or firm patch can precede an ulcer.' },
      { terms: ['painless ulcer', 'ulcer is painless', 'swelling became an ulcer', 'turned into an ulcer'], weight: 42, reason: 'A painless or evolving ulcer needs prompt in-person assessment.' },
      { terms: ['getting larger', 'keeps enlarging', 'arm', 'leg', 'face'], weight: 10, reason: 'Enlargement or a typical exposed location adds support.' },
      { terms: ['no fever', 'without fever'], weight: 8, reason: 'This pattern can begin without fever.' },
    ],
    negatives: [{ terms: ['very painful', 'hot and swollen'], weight: 30, reason: 'Marked pain, heat and swelling require an urgent infection pathway.' }],
    missing: ['Did this begin as a painless swelling or firm patch?', 'Is there now an open ulcer, and is it enlarging?', 'Is movement limited or could a joint or bone be involved?'],
  },
  {
    id: 'numb-patch-like', label: 'Numb changed-colour patch pattern',
    positives: [
      { terms: ['leprosy', 'hansen disease', "hansen's disease"], weight: 56, reason: 'A named sensory-loss condition was reported and needs in-person confirmation.' },
      { terms: ['reduced feeling', 'loss of feeling', 'loss of sensation', 'reduced sensation'], weight: 42, reason: 'Reduced sensation in a skin patch requires an in-person examination.' },
      { terms: ['numb skin patch', 'numb patch', 'numbness in the patch'], weight: 38, reason: 'Numbness within a patch supports this examination pathway.' },
      { terms: ['lighter patch', 'changed-colour patch', 'changed-color patch', 'pale patch'], weight: 18, reason: 'A changed-colour patch adds support when sensation is also reduced.' },
      { terms: ['new weakness', 'nerve weakness'], weight: 20, reason: 'New weakness may indicate nerve involvement and should not be assessed through skincare.' },
    ],
    negatives: [
      { terms: ['no numbness', 'normal feeling', 'normal sensation'], weight: 48, reason: 'Normal sensation points away from a sensory-loss pattern.' },
      { terms: ['fine scale', 'itchy patch'], weight: 16, reason: 'Scale or prominent itch can support a different skin pattern.' },
    ],
    missing: ['Is feeling reduced inside the patch?', 'Is the patch lighter or otherwise changed in colour?', 'Is there new weakness, sudden one-sided weakness or speech trouble?'],
  },
  {
    id: 'velvety-thickening-like', label: 'Dark velvety-thickening pattern',
    positives: [
      { terms: ['acanthosis nigricans'], weight: 56, reason: 'A named skin thickening was reported and its cause needs medical review.' },
      { terms: ['dark thickened velvety', 'dark velvety skin', 'thick velvety skin', 'velvety texture'], weight: 48, reason: 'Dark, thickened skin with a velvet-like feel supports this review pathway.' },
      { terms: ['does not scrub away', "doesn't scrub away", 'cannot scrub away', "can't scrub away"], weight: 28, reason: 'Skin change that does not scrub away should not be treated as surface dirt.' },
      { terms: ['neck', 'armpit', 'armpits', 'groin', 'body folds'], weight: 8, reason: 'The reported skin-fold location can fit this pattern.' },
    ],
    negatives: [{ terms: ['flat mark', 'after acne', 'post acne'], weight: 28, reason: 'A flat mark after inflammation supports a different pigmentation pattern.' }],
    missing: ['Does the area feel thicker or velvety?', 'Is it on the neck, armpit or another body fold?', 'Is this new or changing, or did it begin after a medicine change?'],
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
    id: 'keloid-scar-like', label: 'Growing raised-scar pattern',
    positives: [
      { terms: ['keloid', 'keloid scar'], weight: 56, reason: 'A named raised-scar condition was reported and needs confirmation.' },
      { terms: ['raised scar grew beyond', 'scar growing beyond', 'growth beyond the wound', 'raised scar spreading'], weight: 48, reason: 'Scar tissue extending beyond the original injury supports this pattern.' },
      { terms: ['raised scar after a piercing', 'raised scar after piercing', 'raised scar after a cut', 'raised scar after a burn', 'raised scar after acne'], weight: 16, reason: 'A preceding skin injury supports a scar-related pattern.' },
      { terms: ['firm rubbery scar', 'itchy raised scar', 'painful raised scar'], weight: 22, reason: 'Firmness, itch or pain can accompany a raised scar.' },
    ],
    negatives: [{ terms: ['open wound', 'painless ulcer', 'pus'], weight: 24, reason: 'An open, ulcerated or draining lesion needs a different pathway.' }],
    missing: ['Did the growth begin after an injury, acne spot or piercing?', 'Does it extend beyond the original wound?', 'Is it changing quickly, bleeding, ulcerated or limiting movement?'],
  },
  {
    id: 'acne-keloidalis-nuchae-like', label: 'Back-of-neck bump pattern',
    positives: [
      { terms: ['acne keloidalis nuchae', 'akn'], weight: 52, reason: 'A named back-of-neck bump condition was reported and needs confirmation.' },
      { terms: ['back of my neck', 'back of the neck', 'back of my scalp', 'back of the scalp', 'nape of my neck', 'nape of the neck'], weight: 26, reason: 'The back-of-neck or scalp location supports this pattern.' },
      { terms: ['firm bumps', 'dome-shaped bumps', 'dome shaped bumps', 'raised scars', 'tufted hairs', 'tufted hair'], weight: 34, reason: 'Firm bumps, tufted hairs or raised scars support this pattern.' },
      { terms: ['close haircut', 'close-cut', 'close cut', 'close shave', 'helmet friction', 'collar friction'], weight: 18, reason: 'Close cutting or repeated friction can accompany this pattern.' },
    ],
    negatives: [{ terms: ['beard line', 'bikini line', 'trapped hair'], weight: 18, reason: 'A visible trapped hair elsewhere supports an ingrown-hair pattern instead.' }],
    missing: ['Are the bumps at the back of the neck or scalp?', 'Are there raised scars, pus or tufted hairs?', 'Do close cuts, collars or headwear worsen it?'],
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
    id: 'ccca-like', label: 'Crown hair-loss pattern',
    positives: [
      { terms: ['ccca', 'central centrifugal cicatricial alopecia'], weight: 52, reason: 'A named crown hair-loss condition was reported and needs confirmation.' },
      { terms: ['hair loss spreading from the crown', 'hair loss at the crown', 'hair thinning at the crown', 'crown hair loss', 'centre of my scalp', 'center of my scalp'], weight: 46, reason: 'Hair loss beginning around the crown supports this pattern.' },
      { terms: ['smooth shiny scalp', 'scalp looks smooth and shiny', 'shiny scalp'], weight: 28, reason: 'A smooth or shiny scalp can indicate scarring hair loss.' },
      { terms: ['scalp burning', 'burning and tenderness', 'tender scalp', 'scalp tenderness', 'scalp stinging'], weight: 18, reason: 'Burning, stinging or tenderness can accompany this pattern.' },
      { terms: ['breakage at the crown', 'crown breakage', 'breakage in the centre', 'breakage in the center'], weight: 16, reason: 'Central breakage may be an early sign.' },
    ],
    negatives: [
      { terms: ['tight braids', 'hairline thinning', 'edges thinning'], weight: 18, reason: 'Tension and hairline loss support traction-related loss instead.' },
      { terms: ['smooth bald patch', 'round bald patch'], weight: 18, reason: 'A discrete smooth patch can support another hair-loss pattern.' },
    ],
    missing: ['Did thinning begin at the crown and spread outward?', 'Is there burning, tenderness, itch or breakage?', 'Does the scalp look smooth or shiny?'],
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
  {
    id: 'onchocerciasis-like', label: 'Severe itch-with-nodule or eye-change warning pattern',
    positives: [
      { terms: ['onchocerciasis', 'river blindness'], weight: 64, reason: 'A named eye-and-skin infection was reported and needs clinical confirmation.' },
      { terms: ['severe itching with lumps under my skin', 'severe itching with firm lumps under my skin', 'severe itch with lumps under the skin', 'severe itch with firm lumps under the skin', 'itchy rash with lumps under my skin', 'severe itchy skin with firm lumps'], weight: 46, reason: 'Severe itch with subcutaneous lumps needs an in-person eye-and-skin assessment.' },
      { terms: ['severe itching and vision changes', 'itchy skin and blurred vision', 'itchy rash with worsening vision', 'itching with vision loss'], weight: 48, reason: 'Itching with sight changes requires prompt clinical assessment.' },
      { terms: ['lumps under my skin and my vision is getting worse', 'skin nodules with blurred vision', 'firm lumps under the skin and reduced vision'], weight: 48, reason: 'Subcutaneous lumps with sight changes require prompt assessment.' },
      { terms: ['repeated blackfly bites', 'live near a fast-flowing river', 'work near a fast-flowing river', 'riverine community'], weight: 8, reason: 'Repeated exposure near fast-flowing rivers adds context but is not diagnostic.' },
    ],
    negatives: [
      { terms: ['itch worse at night', 'household is itchy', 'family is itchy'], weight: 34, reason: 'Night itch affecting close contacts supports a contagious household-itch pattern.' },
      { terms: ['painful draining lumps', 'armpit tunnels', 'groin tunnels'], weight: 34, reason: 'Painful draining fold lesions support a hidradenitis-like pathway.' },
    ],
    missing: ['Is there blurred, reduced or worsening vision, eye pain, redness or light sensitivity?', 'Are there firm lumps under the skin or lasting skin changes?', 'Have you lived or worked near fast-flowing rivers with repeated biting-fly exposure?'],
  },
  {
    id: 'chronic-lymphoedema-like', label: 'Persistent swelling-with-skin-change pattern',
    positives: [
      { terms: ['lymphatic filariasis', 'elephantiasis'], weight: 66, reason: 'A named condition associated with chronic tissue swelling was reported and needs clinical confirmation.' },
      { terms: ['lymphoedema', 'lymphedema'], weight: 54, reason: 'A named chronic swelling condition was reported and needs cause-finding and continuing care.' },
      { terms: ['persistent leg swelling with thickened skin', 'persistent arm swelling with thickened skin', 'long-term leg swelling with hard skin', 'long-term arm swelling with hard skin', 'leg has stayed swollen for months and the skin is becoming thick', 'arm has stayed swollen for months and the skin is becoming thick'], weight: 48, reason: 'Persistent swelling with progressive skin thickening needs an in-person assessment.' },
      { terms: ['swollen limb with deep skin folds', 'swollen leg with hard tight skin', 'swollen arm with hard tight skin', 'fluid leaking through the swollen skin', 'repeated skin infections in the swollen limb'], weight: 46, reason: 'Skin changes or repeated infection alongside chronic swelling support a lymphatic-swelling assessment.' },
    ],
    negatives: [
      { terms: ['swelling started today after an injury', 'temporary swelling after standing', 'goes down overnight'], weight: 28, reason: 'A short-lived or clearly injury-linked change is less specific for a chronic swelling pattern.' },
      { terms: ['painful hot spreading swelling', 'hot and swollen with fever'], weight: 34, reason: 'Acute heat, pain or fever requires the infection pathway first.' },
      { terms: ['swollen lips', 'swollen tongue', 'swollen throat'], weight: 44, reason: 'Face or airway swelling requires the allergic-reaction safety pathway.' },
    ],
    missing: ['How long has the swelling been present, and is it worsening?', 'Is one side or both sides affected?', 'Is the skin hard, thickened, folded, leaking or repeatedly infected?', 'Did pain, warmth, fever, chest pain or breathlessness begin with it?'],
  },
  {
    id: 'scabies-like', label: 'Household night-itch pattern',
    positives: [
      { terms: ['scabies'], weight: 52, reason: 'A named contagious-itch condition was reported and needs confirmation.' },
      { terms: ['itching at night', 'itch worse at night', 'night-time itch', 'nighttime itch', 'night itch'], weight: 40, reason: 'Itch that is worse at night supports this pattern.' },
      { terms: ['between my fingers', 'between the fingers', 'finger webs', 'wrists', 'belt area'], weight: 18, reason: 'The reported distribution can fit this pattern.' },
      { terms: ['other people at home are itchy', 'household is itchy', 'family is itchy', 'close contacts are itchy', 'others at home are itchy'], weight: 34, reason: 'Similar itch in close contacts raises concern for a contagious pattern.' },
      { terms: ['itchy lines', 'skin burrows', 'burrows'], weight: 20, reason: 'Itchy lines or burrows add support.' },
    ],
    missing: ['Is the itch worse at night?', 'Are finger webs, wrists or the belt area affected?', 'Is anyone close to you also itching?'],
  },
];

export const differentialPatternIds = rules.map(rule => rule.id);

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
