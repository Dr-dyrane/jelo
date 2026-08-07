import type { Product } from '@/data/products';

const ngOffer = (retailer: string, url: string, trust = 92): Product['offers'][number] => ({ retailer, url, trust, available: true, location: ['NG'] });
const usOffer = (retailer: string, url: string, trust = 94, priceUsd?: number): Product['offers'][number] => ({ retailer, url, trust, available: true, priceUsd, checkedAt: priceUsd ? '2026-07-20' : undefined, match: url.includes('/search') || url.includes('/s?') ? 'search' : 'exact', location: ['US'] });

export const expandedProducts: Product[] = [
  {
    slug: 'the-ordinary-azelaic-acid-suspension-10', brand: 'The Ordinary', name: 'Azelaic Acid Suspension 10%', size: '30 ml', category: 'Face', step: 'Treat',
    image: 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dw711cec9a/Images/products/The%20Ordinary/rdn-azelaic-acid-suspension-10pct-30ml.png?sw=1200&sh=1200&sm=fit', displayLine: 'Clarify · even',
    bestFor: ['post-acne marks', 'redness', 'uneven texture'], concerns: ['acne', 'hyperpigmentation', 'dark spots', 'redness', 'texture'], skinTypes: ['oily', 'combination', 'normal'], sensitiveFriendly: true,
    usage: 'Apply a small amount in the evening; separate from strong acids and retinoids when introducing.', evidence: 'high',
    offers: [ngOffer('Beauty by Daz', 'https://beautybydaz.com/?s=the+ordinary+azelaic+acid&post_type=product', 88), usOffer('Ulta Beauty', 'https://www.ulta.com/p/azelaic-acid-suspension-10-cream-redness-blemish-prone-skin-pimprod2007104', 94, 12.2)]
  },
  {
    slug: 'la-roche-posay-anthelios-uvmune-400-oil-control-fluid', brand: 'La Roche-Posay', name: 'Anthelios UVMune 400 Oil Control Fluid SPF50+', size: '50 ml', category: 'Face', step: 'Protect',
    image: 'https://www.laroche-posay.co.uk/dw/image/v2/AAQP_PRD/on/demandware.static/-/Sites-lrp-ng-master-catalog/default/dw8210e9ef/LRP_Product/Anthelios/3337875847292_Anthelios-UVMune-400-Oil-Control-Invisible-Fluid_50ml_01_La_Roche_Posay.jpg?sw=1356&sh=1356&sm=cut&sfrm=jpg&q=95', displayLine: 'Protect · mattify',
    bestFor: ['oily skin', 'high UVA protection', 'pigmentation prevention'], concerns: ['oiliness', 'hyperpigmentation', 'dark spots', 'sensitivity'], skinTypes: ['oily', 'combination', 'sensitive'], sensitiveFriendly: true,
    usage: 'Apply generously every morning and reapply with sun exposure.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50/'), usOffer('Amazon US', 'https://www.amazon.com/s?k=La+Roche-Posay+UVMune+400+Oil+Control')]
  },
  {
    slug: 'la-roche-posay-toleriane-double-repair-spf30', brand: 'La Roche-Posay', name: 'Toleriane Double Repair Face Moisturizer UV SPF 30', size: '100 ml', category: 'Face', step: 'Protect',
    image: 'https://media.ulta.com/i/ulta/2503390?fmt=auto&qlt=90&wid=1200', displayLine: 'Repair · protect',
    bestFor: ['barrier support', 'daily moisture', 'sensitive skin'], concerns: ['barrier', 'dryness', 'sensitivity', 'hyperpigmentation'], skinTypes: ['normal', 'dry', 'combination', 'sensitive'], sensitiveFriendly: true,
    usage: 'Use every morning as moisturizer and sunscreen; reapply sunscreen as needed.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/catalogsearch/result/?q=toleriane%20double%20repair'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/toleriane-double-repair-face-moisturizer-uv-spf-30-xlsImpprod15681007?sku=2503390', 94, 28.99)]
  },
  {
    slug: 'la-roche-posay-toleriane-double-repair-matte', brand: 'La Roche-Posay', name: 'Toleriane Double Repair Matte Moisturizer', size: '75 ml', category: 'Face', step: 'Moisturize',
    image: 'https://media.ulta.com/i/ulta/2591830?fmt=auto&qlt=90&wid=1200', displayLine: 'Hydrate · mattify',
    bestFor: ['oily skin', 'visible pores', 'barrier support'], concerns: ['oiliness', 'pores', 'barrier', 'texture'], skinTypes: ['oily', 'combination'], sensitiveFriendly: true,
    usage: 'Apply after treatment steps morning or evening.', evidence: 'high',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/catalogsearch/result/?q=toleriane%20double%20repair%20matte'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/toleriane-double-repair-matte-face-moisturizer-oily-skin-pimprod2030179', 94, 27.99)]
  },
  {
    slug: 'cosrx-advanced-snail-96-mucin-power-essence', brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence', size: '100 ml', category: 'Face', step: 'Essence',
    image: 'https://www.cosrx.com/cdn/shop/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806.jpg?v=1763111577', displayLine: 'Hydrate · recover',
    bestFor: ['dehydration', 'post-blemish recovery', 'barrier support'], concerns: ['dryness', 'barrier', 'sensitivity', 'dark spots'], skinTypes: ['all'], sensitiveFriendly: true,
    usage: 'Pat onto damp skin after cleansing and before moisturizer.', evidence: 'moderate',
    offers: [ngOffer('Care to Beauty', 'https://www.caretobeauty.com/ng/cosrx-advanced-snail-96-mucin-power-essence-100ml/'), usOffer('Ulta Beauty', 'https://www.ulta.com/p/advanced-snail-96-mucin-power-essence-xlsImpprod15641052', 94, 20.9)]
  },
  {
    slug: 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide', brand: 'PanOxyl', name: 'Acne Foaming Wash 10% Benzoyl Peroxide', size: '156 g', category: 'Face', step: 'Cleanse',
    image: 'https://panoxyl.com/wp-content/uploads/2023/06/PanOxyl_Acne-Foaming-Wash_Front_5.5oz-Tube_SILO_wide.webp', displayLine: 'Treat · clear',
    bestFor: ['inflammatory acne', 'body acne', 'oily skin'], concerns: ['acne', 'body acne', 'breakouts'], skinTypes: ['oily', 'combination'], sensitiveFriendly: false,
    usage: 'Use as a short-contact wash initially; rinse thoroughly and protect fabrics from bleaching.', evidence: 'high',
    offers: [ngOffer('Jumia', 'https://www.jumia.com.ng/catalog/?q=panoxyl+10+benzoyl+peroxide', 62), usOffer('Ulta Beauty', 'https://www.ulta.com/p/acne-foaming-wash-with-10-benzoyl-peroxide-pimprod2040401', 94, 13.49)]
  },
  {
    slug: 'nizoral-ad-ketoconazole-shampoo', brand: 'Nizoral', name: 'A-D Anti-Dandruff Shampoo 1% Ketoconazole', size: '200 ml', category: 'Hair', step: 'Treat',
    image: 'https://cdn.onbuy.com/product/9c7eef22ae1f4d1a84ec5108d23ebd06/500-500/pf2k76p.jpg', displayLine: 'Control · calm',
    bestFor: ['persistent dandruff', 'itchy flaky scalp'], concerns: ['dandruff', 'itch', 'flaking', 'seborrheic dermatitis'], skinTypes: ['scalp'], sensitiveFriendly: true,
    usage: 'Use according to the package directions; leave on the scalp briefly before rinsing.', evidence: 'high',
    offers: [ngOffer('Jumia', 'https://www.jumia.com.ng/catalog/?q=nizoral+shampoo', 62), usOffer('Walmart', 'https://www.walmart.com/search?q=Nizoral+A-D+shampoo', 90)]
  },
  {
    slug: 'skin-by-zaron-vitamin-c-body-lotion-500ml', brand: 'Skin by Zaron', name: 'Vitamin C Brightening/Moisturizing Body Lotion', size: '500 ml', category: 'Body', step: 'Moisturize',
    image: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2024/09/vecg0cn6.png?fit=1200%2C1200&quality=80&ssl=1', displayLine: 'Daily body moisture · 500 ml',
    bestFor: [], concerns: [], skinTypes: [], sensitiveFriendly: false,
    usage: 'Apply to clean skin. Can be used morning and evening.', evidence: 'emerging',
    offers: [{
      retailer: 'BuyBetter',
      url: 'https://buybetter.ng/product/skin-by-zaron-vitamin-c-brightening-moisturizing-body-lotion-500ml/',
      trust: 78, available: true, priceNgn: 14800, checkedAt: '2026-07-22T18:27:03.806Z', match: 'exact',
      listingEvidence: { observedAt: '2026-07-22T18:27:03.806Z', sourceUrl: 'https://buybetter.ng/product/skin-by-zaron-vitamin-c-brightening-moisturizing-body-lotion-500ml/', basis: 'retailer-page' },
      priceObservation: { observedAt: '2026-07-22T18:27:03.806Z', variant: 'Vitamin C Brightening/Moisturizing Body Lotion', size: '500 ml', stock: 'in-stock', landedCost: 'unknown' },
      location: ['NG'],
    }]
  }
];
