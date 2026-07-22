import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchingCatalogueSearchSuggestions,
  type CatalogueSearchSuggestion,
} from '@/components/products/catalogue-search-suggestions';

const suggestions: CatalogueSearchSuggestion[] = [
  { kind: 'category', label: 'Face care', detail: '8 products', href: '/products?category=Face+care' },
  { kind: 'guide', label: 'Oily and congested skin', detail: 'Concern guide', href: '/concerns/oily-congested-skin', keywords: ['oiliness', 'acne'] },
  { kind: 'company', label: 'CeraVe', detail: '4 products', href: '/products?brand=CeraVe' },
  { kind: 'product', label: 'Hydrating Cleanser', detail: 'CeraVe', href: '/products/cerave-hydrating-cleanser', keywords: ['473 ml'] },
  { kind: 'product', label: 'Niacinamide 10% + TXA 4% Serum', detail: 'Anua', href: '/products/anua-niacinamide', keywords: ['30 ml'] },
];

test('catalogue search suggestions rank exact labels before related products', () => {
  const matches = matchingCatalogueSearchSuggestions(suggestions, 'cerave');
  assert.deepEqual(matches.map(item => item.kind), ['company', 'product']);
  assert.equal(matches[0]?.label, 'CeraVe');
});

test('catalogue search suggestions normalize punctuation and use reviewed guide terms', () => {
  assert.equal(matchingCatalogueSearchSuggestions(suggestions, 'niacinamide txa')[0]?.label, 'Niacinamide 10% + TXA 4% Serum');
  assert.equal(matchingCatalogueSearchSuggestions(suggestions, 'oiliness')[0]?.href, '/concerns/oily-congested-skin');
  assert.deepEqual(matchingCatalogueSearchSuggestions(suggestions, 'eczema'), []);
});

test('catalogue search suggestions stay compact and deduplicate destinations', () => {
  const repeated = [...suggestions, suggestions[0]];
  assert.deepEqual(
    matchingCatalogueSearchSuggestions(repeated, '', 3).map(item => item.href),
    suggestions.slice(0, 3).map(item => item.href),
  );
});
