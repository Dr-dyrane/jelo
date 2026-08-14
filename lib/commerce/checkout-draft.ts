import type { BasketItem } from './basket';

export const CHECKOUT_DRAFT_STORAGE_KEY = 'jelocare:checkout-draft:v1';

export const CHECKOUT_DRAFT_FIELD_LIMITS = {
  contactName: 120,
  contactEmail: 320,
  contactPhone: 40,
  deliveryAddress: 500,
  deliveryCity: 120,
  deliveryState: 120,
  deliveryPostalCode: 20,
  deliveryInstructions: 500,
} as const;

export type CheckoutDraftField = keyof typeof CHECKOUT_DRAFT_FIELD_LIMITS;
export type CheckoutDraftStep = 'contact' | 'delivery' | 'review';

export type CheckoutDraft = {
  signature: string;
  step: CheckoutDraftStep;
  fields: Partial<Record<CheckoutDraftField, string>>;
  emailNotificationsConsent: boolean;
  whatsappConsent: boolean;
};

const checkoutDraftSteps: readonly CheckoutDraftStep[] = [
  'contact',
  'delivery',
  'review',
];

export function checkoutDraftSignature(
  retailer: string,
  items: readonly BasketItem[],
) {
  return JSON.stringify({
    retailer,
    lines: items.map(({ slug, quantity }) => ({ slug, quantity })),
  });
}

function cleanFields(value: unknown): CheckoutDraft['fields'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(CHECKOUT_DRAFT_FIELD_LIMITS).flatMap(([field, limit]) => {
      const candidate = record[field];
      return typeof candidate === 'string'
        ? [[field, candidate.slice(0, limit)]]
        : [];
    }),
  );
}

export function parseCheckoutDraft(
  raw: string | null,
  expectedSignature: string,
): CheckoutDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.version !== 1 ||
      value.signature !== expectedSignature ||
      !checkoutDraftSteps.includes(value.step as CheckoutDraftStep)
    ) {
      return null;
    }
    return {
      signature: expectedSignature,
      step: value.step as CheckoutDraftStep,
      fields: cleanFields(value.fields),
      emailNotificationsConsent: value.emailNotificationsConsent === true,
      whatsappConsent: value.whatsappConsent === true,
    };
  } catch {
    return null;
  }
}

export function serializeCheckoutDraft(draft: CheckoutDraft) {
  return JSON.stringify({
    version: 1,
    signature: draft.signature,
    step: draft.step,
    fields: cleanFields(draft.fields),
    emailNotificationsConsent: draft.emailNotificationsConsent,
    whatsappConsent: draft.whatsappConsent,
  });
}
