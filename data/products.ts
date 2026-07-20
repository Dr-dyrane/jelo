export type Offer = {
  retailer: string;
  url: string;
  trust: number;
  available: boolean;
  priceNgn?: number;
  location: string[];
};

export type Product = {
  slug: string;
  brand: string;
  name: string;
  size: string;
  category: 'Face' | 'Hair' | 'Body';
  step: string;
  image: string;
  displayLine: string;
  bestFor: string[];
  concerns: string[];
  skinTypes: string[];
  sensitiveFriendly: boolean;
  usage: string;
  evidence: 'high' | 'moderate' | 'emerging';
  offers: Offer[];
};

export const products: Product[] = [
  {
    slug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
    brand: 'COSRX', name: 'Salicylic Acid Daily Gentle Cleanser', size: '150 ml', category: 'Face', step: 'Cleanse',
    image: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2023/08/4167669000000143025-optimized.jpg?fit=680%2C680&quality=89&ssl=1',
    displayLine: 'Cleanse · clarify', bestFor: ['oily skin', 'blackheads', 'congestion'], concerns: ['acne', 'blackheads', 'whiteheads', 'pores'], skinTypes: ['oily', 'combination'], sensitiveFriendly: true, usage: 'Morning or evening; reduce frequency if tight or irritated.', evidence: 'moderate',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face/cosrx-salicylic-acid-cleanser/', trust: 100, available: true, location: ['NG'] },
      { retailer: 'Care to Beauty', url: 'https://www.caretobeauty.com/ng/cosrx-salicylic-acid-daily-gentle-cleanser-150ml/', trust: 92, available: true, location: ['NG','INTL'] }
    ]
  },
  {
    slug: 'some-by-mi-aha-bha-pha-miracle-toner',
    brand: 'SOME BY MI', name: 'AHA·BHA·PHA 30 Days Miracle Toner', size: '150 ml', category: 'Face', step: 'Exfoliate',
    image: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2020/01/kxq1lqyk-1-optimized.png?quality=80&resize=411%2C442&ssl=1',
    displayLine: 'Exfoliate · refine', bestFor: ['blackheads', 'uneven texture', 'congestion'], concerns: ['blackheads','whiteheads','pores','texture'], skinTypes: ['oily','combination'], sensitiveFriendly: false, usage: 'Evening, initially twice weekly.', evidence: 'moderate',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face/some-by-mi-aha-bha-pha-30-days-miracle-toner/', trust: 100, available: true, location: ['NG'] },
      { retailer: 'Care to Beauty', url: 'https://www.caretobeauty.com/ng/some-by-mi-30-days-miracle-toner-150ml/', trust: 92, available: true, location: ['NG','INTL'] }
    ]
  },
  {
    slug: 'anua-niacinamide-10-txa-4-serum',
    brand: 'ANUA', name: 'Niacinamide 10% + TXA 4% Serum', size: '30 ml', category: 'Face', step: 'Treat',
    image: 'https://i0.wp.com/buybetter.ng/wp-content/uploads/2024/06/skdbvd-1-optimized.jpg?fit=425%2C425&quality=89&ssl=1',
    displayLine: 'Correct · brighten', bestFor: ['post-acne marks', 'uneven tone', 'visible pores'], concerns: ['hyperpigmentation','dark spots','pores','oiliness'], skinTypes: ['oily','combination','normal'], sensitiveFriendly: true, usage: 'Morning and most evenings; introduce gradually.', evidence: 'moderate',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face/anua-niacinamide-10-tranexamin-acid-4-serum/', trust: 100, available: true, location: ['NG'] },
      { retailer: 'Care to Beauty', url: 'https://www.caretobeauty.com/ng/anua-niacinamide-10-txa-4-serum-30ml/', trust: 92, available: true, location: ['NG','INTL'] }
    ]
  },
  {
    slug: 'face-facts-wonder-cream-fragrance-free',
    brand: 'FACE FACTS', name: 'Wonder Cream Fragrance Free', size: '50 ml', category: 'Face', step: 'Moisturize',
    image: 'https://peronabeauty.com/wp-content/uploads/2024/12/Screenshot-at--600x605.png',
    displayLine: 'Hydrate · comfort', bestFor: ['barrier support', 'light hydration'], concerns: ['sensitivity','dryness','barrier'], skinTypes: ['oily','combination','normal','dry'], sensitiveFriendly: true, usage: 'Morning or barrier-focused evenings.', evidence: 'moderate',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face-facts-wonder-cream-50ml-2/', trust: 100, available: false, location: ['NG'] },
      { retailer: 'Perona Beauty', url: 'https://peronabeauty.com/product/face-facts-wonder-cream-fragrance-free/', trust: 86, available: true, location: ['NG'] }
    ]
  },
  {
    slug: 'face-facts-bright-clear-face-cream',
    brand: 'FACE FACTS', name: 'Bright + Clear Face Cream', size: '75 ml', category: 'Face', step: 'Moisturize',
    image: 'https://peronabeauty.com/wp-content/uploads/2024/08/face-facts_387858-600x600.jpg',
    displayLine: 'Even · soften', bestFor: ['dark marks', 'uneven tone'], concerns: ['hyperpigmentation','dark spots'], skinTypes: ['oily','combination','normal'], sensitiveFriendly: false, usage: 'Evening; patch test first.', evidence: 'emerging',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face/face-facts-bright-clear-face-cream-75ml/', trust: 100, available: true, location: ['NG'] },
      { retailer: 'Perona Beauty', url: 'https://peronabeauty.com/product/face-facts-bright-clear-face-cream-75ml/', trust: 86, available: true, location: ['NG'] }
    ]
  },
  {
    slug: 'b-lab-matcha-hydrating-real-sunscreen',
    brand: 'B.LAB', name: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++', size: '50 ml', category: 'Face', step: 'Protect',
    image: 'https://peronabeauty.com/wp-content/uploads/2024/02/IMG-1630-600x600.jpg',
    displayLine: 'Shield · preserve', bestFor: ['daily UV protection', 'pigmentation prevention'], concerns: ['hyperpigmentation','dark spots','sensitivity'], skinTypes: ['oily','combination','normal','dry'], sensitiveFriendly: true, usage: 'Every morning as the final skincare step.', evidence: 'high',
    offers: [
      { retailer: 'Beauty by Daz', url: 'https://beautybydaz.com/shop/face/sunscreens/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/', trust: 100, available: true, location: ['NG'] },
      { retailer: 'Perona Beauty', url: 'https://peronabeauty.com/product/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/', trust: 86, available: true, location: ['NG'] }
    ]
  }
];
