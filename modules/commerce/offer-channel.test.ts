import assert from 'node:assert/strict';
import test from 'node:test';
import type { Offer } from '@/data/products';
import {
  offerActionLabel,
  offerFulfilmentLabel,
  offerOrderChannels,
} from './offer-channel';

function offer(patch: Partial<Offer> = {}): Offer {
  return {
    retailer: 'Glow Store',
    url: 'https://example.com/glow',
    trust: 80,
    available: true,
    location: ['NG'],
    ...patch,
  };
}

test('website offers retain a clear store action by default', () => {
  assert.deepEqual(offerOrderChannels(offer()), ['website']);
  assert.equal(offerActionLabel(offer()), 'Open store');
});

test('social and physical offers expose the action users can take', () => {
  assert.equal(offerActionLabel(offer({ orderChannels: ['instagram'] })), 'Open profile');
  assert.equal(offerActionLabel(offer({ orderChannels: ['whatsapp', 'instagram'] })), 'Message store');
  assert.equal(offerActionLabel(offer({ orderChannels: ['physical'] })), 'Get directions');
});

test('fulfilment and location remain concise', () => {
  assert.equal(
    offerFulfilmentLabel(offer({
      fulfilment: ['pickup', 'delivery'],
      locationLabel: 'Ikeja',
    })),
    'Pickup · Delivery · Ikeja',
  );
});
