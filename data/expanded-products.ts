import type { Product } from '@/data/products';

const ngOffer = (retailer: string, url: string, trust = 92): Product['offers'][number] => ({ retailer, url, trust, available: true, location: ['NG'] });
const usOffer = (retailer: string, url: string, trust = 94): Product['offers'][number] => ({ retailer, url, trust, available: true, location: ['US'] });

export const expandedProducts: Product[] = [
  {
    slug: 'cerave-foaming-facial-cleanser', brand: 'CeraVe', name: 'Foaming Facial Cleanser', size: '355 ml', category: 'Face', step: 'Cleanse',
    image: 'https://media.ulta.com/i/ulta/2254420?fmt=auto&qlt=90&wid=1200', displayLine: 'Cleanse · balance',
    bestFor: ['normal to oily skin', 'excess oil', 'daily cleansing'], concerns: ['oiliness', 'pores', 'acne', 'barrier'], skinTypes: ['normal', 'oily', 'combination'], sensitiveFriendly: true,
    usage: 'Massage onto damp skin, rinse, and avoid over-cleansing.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/cerave-foaming-cleanser-normal-to-oily-skin-236ml/'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/foaming-facial-cleanser-xlsImpprod5140065?sku=2254420')]
  },
  {
    slug: 'cerave-blemish-control-cleanser', brand: 'CeraVe', name: 'Blemish Control Cleanser', size: '236 ml', category: 'Face', step: 'Cleanse',
    image: 'https://www.caretobeauty.com/on/demandware.static/-/Sites-master-catalog/default/dw76f267bd/images/large/cerave-blemish-control-cleanser-236ml.jpg', displayLine: 'Unclog · smooth',
    bestFor: ['blemish-prone skin', 'blackheads', 'congestion'], concerns: ['acne', 'blackheads', 'whiteheads', 'pores'], skinTypes: ['oily', 'combination'], sensitiveFriendly: false,
    usage: 'Begin once daily or every other day; reduce if dry or irritated.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/cerave-blemish-control-cleanser-236ml/'), usOffer('Amazon US', 'https://www.amazon.com/s?k=CeraVe+Blemish+Control+Cleanser')]
  },
  {
    slug: 'the-ordinary-azelaic-acid-suspension-10', brand: 'The Ordinary', name: 'Azelaic Acid Suspension 10%', size: '30 ml', category: 'Face', step: 'Treat',
    image: 'https://media.ulta.com/i/ulta/2551154?fmt=auto&qlt=90&wid=1200', displayLine: 'Clarify · even',
    bestFor: ['post-acne marks', 'redness', 'uneven texture'], concerns: ['acne', 'hyperpigmentation', 'dark spots', 'redness', 'texture'], skinTypes: ['oily', 'combination', 'normal'], sensitiveFriendly: true,
    usage: 'Apply a small amount in the evening; separate from strong acids and retinoids when introducing.', evidence: 'high',
    offers: [ngOffer('Beauty by Daz', 'https://beautybydaz.com/?s=the+ordinary+azelaic+acid&post_type=product', 88), usOffer('Ulta Beauty', 'https://www.ulta.com/p/azelaic-acid-suspension-10-cream-redness-blemish-prone-skin-pimprod2007104')]
  },
  {
    slug: 'la-roche-posay-anthelios-uvmune-400-oil-control-fluid', brand: 'La Roche-Posay', name: 'Anthelios UVMune 400 Oil Control Fluid SPF50+', size: '50 ml', category: 'Face', step: 'Protect',
    image: 'https://www.caretobeauty.com/on/demandware.static/-/Sites-master-catalog/default/dwcbf5989d/images/large/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50-50ml.jpg', displayLine: 'Protect · mattify',
    bestFor: ['oily skin', 'high UVA protection', 'pigmentation prevention'], concerns: ['oiliness', 'hyperpigmentation', 'dark spots', 'sensitivity'], skinTypes: ['oily', 'combination', 'sensitive'], sensitiveFriendly: true,
    usage: 'Apply generously every morning and reapply with sun exposure.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50/'), usOffer('Amazon US', 'https://www.amazon.com/s?k=La+Roche-Posay+UVMune+400+Oil+Control')]
  },
  {
    slug: 'la-roche-posay-toleriane-double-repair-spf30', brand: 'La Roche-Posay', name: 'Toleriane Double Repair Face Moisturizer UV SPF 30', size: '100 ml', category: 'Face', step: 'Protect',
    image: 'https://media.ulta.com/i/ulta/2503390?fmt=auto&qlt=90&wid=1200', displayLine: 'Repair · protect',
    bestFor: ['barrier support', 'daily moisture', 'sensitive skin'], concerns: ['barrier', 'dryness', 'sensitivity', 'hyperpigmentation'], skinTypes: ['normal', 'dry', 'combination', 'sensitive'], sensitiveFriendly: true,
    usage: 'Use every morning as moisturizer and sunscreen; reapply sunscreen as needed.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/catalogsearch/result/?q=toleriane%20double%20repair'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/toleriane-double-repair-face-moisturizer-uv-spf-30-xlsImpprod15681007?sku=2503390')]
  },
  {
    slug: 'la-roche-posay-toleriane-double-repair-matte', brand: 'La Roche-Posay', name: 'Toleriane Double Repair Matte Moisturizer', size: '75 ml', category: 'Face', step: 'Moisturize',
    image: 'https://media.ulta.com/i/ulta/2591830?fmt=auto&qlt=90&wid=1200', displayLine: 'Hydrate · mattify',
    bestFor: ['oily skin', 'visible pores', 'barrier support'], concerns: ['oiliness', 'pores', 'barrier', 'texture'], skinTypes: ['oily', 'combination'], sensitiveFriendly: true,
    usage: 'Apply after treatment steps morning or evening.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/catalogsearch/result/?q=toleriane%20double%20repair%20matte'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/toleriane-double-repair-matte-face-moisturizer-oily-skin-pimprod2030179')]
  },
  {
    slug: 'cosrx-advanced-snail-96-mucin-power-essence', brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence', size: '100 ml', category: 'Face', step: 'Essence',
    image: 'https://www.cosrx.com/cdn/shop/files/advanced-snail-96-mucin-power-essence-cosrx-official-1.png?v=1724831000', displayLine: 'Hydrate · recover',
    bestFor: ['dehydration', 'post-blemish recovery', 'barrier support'], concerns: ['dryness', 'barrier', 'sensitivity', 'dark spots'], skinTypes: ['all'], sensitiveFriendly: true,
    usage: 'Pat onto damp skin after cleansing and before moisturizer.', evidence: 'moderate',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/cosrx-advanced-snail-96-mucin-power-essence-100ml/'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/advanced-snail-96-mucin-power-essence-xlsImpprod15641052')]
  },
  {
    slug: 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide', brand: 'PanOxyl', name: 'Acne Foaming Wash 10% Benzoyl Peroxide', size: '156 g', category: 'Face', step: 'Cleanse',
    image: 'https://panoxyl.com/wp-content/uploads/2023/03/PanOxyl-Acne-Foaming-Wash-10-Benzoyl-Peroxide.png', displayLine: 'Treat · clear',
    bestFor: ['inflammatory acne', 'body acne', 'oily skin'], concerns: ['acne', 'body acne', 'breakouts'], skinTypes: ['oily', 'combination'], sensitiveFriendly: false,
    usage: 'Use as a short-contact wash initially; rinse thoroughly and protect fabrics from bleaching.', evidence: 'high',
    offers: [ngOffer('Jumia', 'https://www.jumia.com.ng/catalog/?q=panoxyl+10+benzoyl+peroxide', 62), usOffer('Ulta Beauty', 'https://www.ulta.com/p/acne-foaming-wash-with-10-benzoyl-peroxide-pimprod2040401')]
  },
  {
    slug: 'nizoral-ad-ketoconazole-shampoo', brand: 'Nizoral', name: 'A-D Anti-Dandruff Shampoo 1% Ketoconazole', size: '200 ml', category: 'Hair', step: 'Treat',
    image: 'https://nizoral.com/wp-content/uploads/2024/01/nizoral-ad-shampoo-bottle.png', displayLine: 'Control · calm',
    bestFor: ['persistent dandruff', 'itchy flaky scalp'], concerns: ['dandruff', 'itch', 'flaking', 'seborrheic dermatitis'], skinTypes: ['scalp'], sensitiveFriendly: true,
    usage: 'Use according to the package directions; leave on the scalp briefly before rinsing.', evidence: 'high',
    offers: [ngOffer('Jumia', 'https://www.jumia.com.ng/catalog/?q=nizoral+shampoo', 62), usOffer('Walmart', 'https://www.walmart.com/search?q=Nizoral+A-D+shampoo', 90)]
  }
];
