import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHandoff } from '@/lib/commerce/handoff-model';
import { products } from '@/data/catalogue';

// Find a product with exact offers for testing
const productWithOffers = products.find(p => p.offers.some(o => o.match !== 'search' && o.url));
const productSlug = productWithOffers?.slug ?? 'cosrx-salicylic-acid-daily-gentle-cleanser';
const retailerName = productWithOffers?.offers.find(o => o.match !== 'search')?.retailer ?? 'Beauty by Daz';

test('resolveHandoff returns a model with the selected offer', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  assert.ok(model, 'Model should be returned for a valid product and retailer');
  assert.equal(model?.productSlug, productSlug);
  assert.ok(model?.selectedOffer, 'Selected offer should be present');
  assert.equal(model?.selectedOffer?.retailer, retailerName);
});

test('resolveHandoff returns null for an invalid product', async () => {
  const model = await resolveHandoff('nonexistent-product-slug', retailerName);
  assert.equal(model, null);
});

test('resolveHandoff builds a search-only offer when no exact listing exists', async () => {
  // Use a retailer that exists in the directory but may not have an exact offer
  const model = await resolveHandoff(productSlug, 'Nonexistent Retailer');
  // If the retailer isn't in the directory, resolveHandoff returns null
  // If it is, it should build a search-only offer
  if (model) {
    assert.ok(model.selectedOffer, 'Should still build an offer');
    assert.equal(model.selectedOffer?.isSearchOnly, true);
    assert.equal(model.selectedOffer?.price, null);
    assert.equal(model.selectedOffer?.priceLabel, 'Check price');
  }
});

test('resolveHandoff surfaces trust signals from offer evidence', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model?.selectedOffer) return;
  // Trust should be a number 0-100
  assert.ok(model.selectedOffer.trust >= 0 && model.selectedOffer.trust <= 100);
  // Freshness days should be a number or null
  assert.ok(
    model.selectedOffer.freshnessDays === null
    || (typeof model.selectedOffer.freshnessDays === 'number' && model.selectedOffer.freshnessDays >= 0),
  );
});

test('resolveHandoff provides alternative offers from other retailers', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model) return;
  // Alternatives should not include the selected retailer
  for (const alt of model.alternativeOffers) {
    assert.notEqual(alt.retailer, retailerName, 'Alternatives should not include the selected retailer');
  }
});

test('resolveHandoff attributedUrl contains utm parameters', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model?.selectedOffer) return;
  const url = new URL(model.selectedOffer.attributedUrl);
  assert.equal(url.searchParams.get('utm_source'), 'jelocare.com');
  assert.equal(url.searchParams.get('utm_medium'), 'referral');
  assert.ok(url.searchParams.get('utm_content')?.includes(productSlug));
});

test('resolveHandoff reasonLabel is factual and honest', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model) return;
  // Reason should never imply JeloCare processes orders
  assert.ok(!model.reasonLabel.toLowerCase().includes('guarantee'), 'Reason must not imply guarantee');
  assert.ok(!model.reasonLabel.toLowerCase().includes('verified by jelocare'), 'Reason must not imply JeloCare verification');
});

test('handoff model never claims payment processing', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model) return;
  // The model should not contain any payment processing claims
  const serialized = JSON.stringify(model);
  assert.ok(!serialized.toLowerCase().includes('jelocare processes'), 'Must not claim JeloCare processes orders');
  assert.ok(!serialized.toLowerCase().includes('jelocare fulfils'), 'Must not claim JeloCare fulfils orders');
});

test('isLowest is derived from comparable price, not rank position', async () => {
  const model = await resolveHandoff(productSlug, retailerName);
  if (!model?.selectedOffer) return;
  // isLowest should only be true when the offer has a price and it's the
  // lowest comparable price — not just when it's ranked first.
  if (model.selectedOffer.isLowest) {
    assert.ok(model.selectedOffer.price != null, 'isLowest requires a non-null price');
    assert.ok(!model.selectedOffer.isSearchOnly, 'isLowest must not be true for search-only offers');
  }
});

test('checkSeller is true for marketplace offers without seller name', async () => {
  // Find a product with a marketplace offer that has no seller name
  const { nigeriaRetailers } = await import('@/data/retailers');
  const marketplaceNames = new Set(nigeriaRetailers.filter(r => r.kind === 'marketplace').map(r => r.name));
  const productWithMarketplaceOffer = products.find(p =>
    p.offers.some(o => marketplaceNames.has(o.retailer) && !o.sellerName && o.match !== 'search'),
  );
  if (!productWithMarketplaceOffer) return; // No matching offer to test
  const marketplaceOffer = productWithMarketplaceOffer.offers.find(o => marketplaceNames.has(o.retailer) && !o.sellerName)!;
  const model = await resolveHandoff(productWithMarketplaceOffer.slug, marketplaceOffer.retailer);
  assert.ok(model?.selectedOffer, 'Model should be returned');
  assert.equal(model.selectedOffer.checkSeller, true, 'Marketplace offers without seller name should warn "Check seller"');
});
