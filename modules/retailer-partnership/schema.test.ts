import assert from 'node:assert/strict';
import test from 'node:test';
import { retailerPartnershipDraftSchema } from '@/lib/retailer-partnership/schema';

const selected = (id: string, label: string) => ({ id, label, source: 'canonical' as const });

function validDraft() {
  return {
    storeName: 'Glow House',
    channels: [selected('channel:physical-store', 'Physical store')],
    state: [selected('state:lagos', 'Lagos')],
    city: 'Ikeja',
    address: '12 Example Street',
    email: 'owner@example.com',
    phone: null,
    whatsapp: '+234 800 000 0000',
    website: null,
    instagram: '@glowhouse',
    facebook: 'https://facebook.com/glowhouse',
    brands: [selected('brand:cosrx', 'COSRX')],
    services: [selected('service:pickup', 'Pickup')],
    sampleProduct: 'COSRX Low pH Cleanser 150 ml',
    samplePriceNgn: 12_500,
    contactConsent: true,
    currentStep: 8,
  };
}

test('a physical retailer can join without a website', () => {
  const parsed = retailerPartnershipDraftSchema.safeParse(validDraft());
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.website, null);
});

test('an online retailer may provide a secure website', () => {
  const parsed = retailerPartnershipDraftSchema.safeParse({
    ...validDraft(),
    channels: [selected('channel:website', 'Website')],
    website: 'https://glow.example',
  });
  assert.equal(parsed.success, true);
});

test('social-first retailers can share Instagram, WhatsApp and Facebook without a website', () => {
  const parsed = retailerPartnershipDraftSchema.safeParse({
    ...validDraft(),
    channels: [
      selected('channel:instagram', 'Instagram'),
      selected('channel:whatsapp', 'WhatsApp'),
      selected('channel:facebook', 'Facebook'),
    ],
    website: null,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.instagram, '@glowhouse');
    assert.equal(parsed.data.whatsapp, '+234 800 000 0000');
    assert.equal(parsed.data.facebook, 'https://facebook.com/glowhouse');
  }
});

test('contact permission, location and a valid email are required', () => {
  assert.equal(retailerPartnershipDraftSchema.safeParse({ ...validDraft(), contactConsent: false }).success, false);
  assert.equal(retailerPartnershipDraftSchema.safeParse({ ...validDraft(), state: [] }).success, false);
  assert.equal(retailerPartnershipDraftSchema.safeParse({ ...validDraft(), email: 'not-an-email' }).success, false);
});
