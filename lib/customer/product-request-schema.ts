import { z } from 'zod';
import { normalizeCustomerProductRequestText } from './product-request-model';

function requiredText(maximum: number) {
  return z.string()
    .transform(normalizeCustomerProductRequestText)
    .pipe(z.string().min(1).max(maximum));
}

function nullableText(maximum: number) {
  return z.union([z.string(), z.null()])
    .transform(value => {
      if (typeof value !== 'string') return null;
      return normalizeCustomerProductRequestText(value) || null;
    })
    .pipe(z.string().max(maximum).nullable());
}

function optionalText(maximum: number) {
  return nullableText(maximum).optional().transform(value => value ?? null);
}

const nullableSourceUrl = z.union([z.string(), z.null()])
  .transform(value => {
    if (typeof value !== 'string') return null;
    return normalizeCustomerProductRequestText(value) || null;
  })
  .pipe(z.url().max(2048).refine(value => value.startsWith('https://')).nullable());

const sourceUrl = nullableSourceUrl.optional().transform(value => value ?? null);

const identityFields = {
  brand: requiredText(120),
  fullPackName: requiredText(240),
  printedSizeVariant: requiredText(120),
  category: optionalText(80),
  retailerLabel: optionalText(160),
  sourceUrl,
};

export const createCustomerProductRequestSchema = z.object({
  ...identityFields,
  photoIdentificationConsent: z.boolean(),
  submit: z.boolean().optional().default(false),
  idempotencyKey: z.uuid(),
}).strict();

export const updateCustomerProductRequestSchema = z.object({
  brand: identityFields.brand.optional(),
  fullPackName: identityFields.fullPackName.optional(),
  printedSizeVariant: identityFields.printedSizeVariant.optional(),
  category: nullableText(80).optional(),
  retailerLabel: nullableText(160).optional(),
  sourceUrl: nullableSourceUrl.optional(),
  photoIdentificationConsent: z.boolean().optional(),
  submit: z.boolean().optional(),
  revision: z.number().int().min(0),
  idempotencyKey: z.uuid(),
}).strict().refine(input => (
  input.brand !== undefined
  || input.fullPackName !== undefined
  || input.printedSizeVariant !== undefined
  || input.category !== undefined
  || input.retailerLabel !== undefined
  || input.sourceUrl !== undefined
  || input.photoIdentificationConsent !== undefined
  || input.submit === true
), { message: 'At least one request change is required.' });

export const customerProductRequestMutationSchema = z.object({
  revision: z.number().int().min(0),
  idempotencyKey: z.uuid(),
}).strict();

export const customerProductRequestIdSchema = z.uuid();

export type CreateCustomerProductRequestInput =
  z.output<typeof createCustomerProductRequestSchema>;
export type UpdateCustomerProductRequestInput =
  z.output<typeof updateCustomerProductRequestSchema>;
export type CustomerProductRequestMutationInput =
  z.output<typeof customerProductRequestMutationSchema>;

export function isCustomerProductRequestPhotoConsentOnlyRevocation(
  input: UpdateCustomerProductRequestInput,
) {
  return input.photoIdentificationConsent === false
    && input.submit !== true
    && input.brand === undefined
    && input.fullPackName === undefined
    && input.printedSizeVariant === undefined
    && input.category === undefined
    && input.retailerLabel === undefined
    && input.sourceUrl === undefined;
}
