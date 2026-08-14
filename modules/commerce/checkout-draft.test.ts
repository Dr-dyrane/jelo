import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  checkoutDraftSignature,
  parseCheckoutDraft,
  serializeCheckoutDraft,
  type CheckoutDraft,
} from '@/lib/commerce/checkout-draft';

test('checkout draft round-trips only the browser-session intake projection', () => {
  const signature = checkoutDraftSignature('Perona Beauty', [
    { slug: 'cleanser', quantity: 1 },
    { slug: 'serum', quantity: 2 },
  ]);
  const serialized = serializeCheckoutDraft({
    signature,
    step: 'delivery',
    fields: {
      contactName: 'Guest Customer',
      contactEmail: 'guest@example.com',
      contactPhone: '+2348000000000',
      deliveryAddress: '1 Example Street',
      deliveryCity: 'Ikeja',
      deliveryState: 'Lagos',
      deliveryInstructions: 'Call at the gate',
    },
    emailNotificationsConsent: true,
    whatsappConsent: false,
  });

  assert.deepEqual(parseCheckoutDraft(serialized, signature), {
    signature,
    step: 'delivery',
    fields: {
      contactName: 'Guest Customer',
      contactEmail: 'guest@example.com',
      contactPhone: '+2348000000000',
      deliveryAddress: '1 Example Street',
      deliveryCity: 'Ikeja',
      deliveryState: 'Lagos',
      deliveryInstructions: 'Call at the gate',
    },
    emailNotificationsConsent: true,
    whatsappConsent: false,
  });
  assert.equal(parseCheckoutDraft(serialized, 'different-basket'), null);
});

test('checkout draft strips unapproved identity, request, payment, and final-acceptance fields', () => {
  const signature = checkoutDraftSignature('Perona Beauty', [
    { slug: 'cleanser', quantity: 1 },
  ]);
  const unsafeDraft = {
    signature,
    step: 'review',
    fields: {
      contactName: 'Guest Customer',
      ownerSubject: 'forbidden',
      paymentReference: 'forbidden',
      requestId: 'forbidden',
      termsAccepted: 'true',
    },
    emailNotificationsConsent: false,
    whatsappConsent: true,
  } as unknown as CheckoutDraft;
  const serialized = serializeCheckoutDraft(unsafeDraft);

  assert.doesNotMatch(
    serialized,
    /ownerSubject|paymentReference|requestId|termsAccepted|forbidden/,
  );
  assert.deepEqual(parseCheckoutDraft(serialized, signature)?.fields, {
    contactName: 'Guest Customer',
  });
});

test('checkout restores matching drafts and clears them with request state after success', async () => {
  const source = await readFile(
    'components/commerce/procurement-basket.tsx',
    'utf8',
  );
  assert.match(source, /parseCheckoutDraft\([\s\S]*CHECKOUT_DRAFT_STORAGE_KEY[\s\S]*draftSignature/);
  assert.match(source, /Saved checkout restored on this tab\./);
  assert.match(source, /sessionStorage\.removeItem\(CHECKOUT_DRAFT_STORAGE_KEY\)/);
  assert.ok(
    source.indexOf('sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY)') <
      source.indexOf('basket.clear()'),
  );
  assert.equal(CHECKOUT_DRAFT_STORAGE_KEY, 'jelocare:checkout-draft:v1');
});
