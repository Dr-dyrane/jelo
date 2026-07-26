import assert from 'node:assert/strict';
import test from 'node:test';
import { assertManualObservationScope, type ManualObservationOffer } from '@/lib/inventory/manual-observation';
import type { ManualObservationCommand } from '@/lib/inventory/manual-observation-command';

const offer: ManualObservationOffer = {
  id: '6b1629ce-b151-4ed6-b91d-b985a6d725d8',
  url: 'https://beauty.example/products/foaming-cleanser',
  market_code: 'NG',
  product_slug: 'cerave-foaming-facial-cleanser',
  brand_name: 'CeraVe',
  product_name: 'Foaming Facial Cleanser',
  product_size: '473 ml',
};

const command: ManualObservationCommand = {
  productSlug: offer.product_slug,
  retailer: 'Beauty by Daz',
  stock: 'in_stock',
  priceNaira: 23_500,
  observedTitle: 'CeraVe Foaming Facial Cleanser 473 ml',
  observedSize: '473ml',
  evidenceNote: 'Price and stock were visible in the browser.',
  rationale: 'The retailer blocks automated verification.',
  validForHours: 24,
  apply: false,
};

test('manual browser observations use the exact offer title, size, route, and NGN scope guard', () => {
  assert.doesNotThrow(() => assertManualObservationScope(offer, command));
  assert.throws(
    () => assertManualObservationScope(offer, { ...command, observedTitle: 'CeraVe Hydrating Facial Cleanser 473 ml' }),
    /title does not match/,
  );
  assert.throws(
    () => assertManualObservationScope(offer, { ...command, observedSize: '355 ml' }),
    /size does not match/,
  );
  assert.throws(
    () => assertManualObservationScope({ ...offer, market_code: 'US' }, command), /currency does not match/);
});
