import { z } from 'zod';
import { adaptiveValueSchema } from '@/lib/community-intake/schema';

const conciseText = z.string()
  .transform(value => value.normalize('NFKC').trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(120));
const optionalText = z.string()
  .transform(value => value.normalize('NFKC').trim().replace(/\s+/g, ' '))
  .pipe(z.string().max(240))
  .nullable();
const optionalUrl = z.union([
  z.null(),
  z.string()
    .transform(value => value.normalize('NFKC').trim())
    .pipe(z.union([z.literal(''), z.url().refine(value => /^https?:\/\//i.test(value), 'Use an http or https link.')])),
])
  .transform(value => value || null);

export const retailerPartnershipDraftSchema = z.object({
  storeName: conciseText,
  channels: z.array(adaptiveValueSchema).min(1).max(5),
  state: z.array(adaptiveValueSchema).min(1).max(1),
  city: conciseText,
  address: optionalText,
  email: z.email().max(254).transform(value => value.trim().toLocaleLowerCase('en-NG')),
  phone: optionalText,
  whatsapp: optionalText,
  website: optionalUrl,
  instagram: optionalText,
  facebook: optionalText.default(null),
  brands: z.array(adaptiveValueSchema).max(30).default([]),
  services: z.array(adaptiveValueSchema).max(8).default([]),
  sampleProduct: optionalText,
  samplePriceNgn: z.number().int().min(100).max(100_000_000).nullable().default(null),
  contactConsent: z.boolean().refine(value => value, 'Contact permission is required.'),
  currentStep: z.number().int().min(1).max(8),
}).strict();

export type RetailerPartnershipDraft = z.infer<typeof retailerPartnershipDraftSchema>;

export const createRetailerPartnershipSchema = retailerPartnershipDraftSchema.pick({
  storeName: true,
  channels: true,
  state: true,
  city: true,
  address: true,
  email: true,
  phone: true,
  whatsapp: true,
  contactConsent: true,
  currentStep: true,
}).extend({
  website: optionalUrl.default(null),
  instagram: optionalText.default(null),
  facebook: optionalText.default(null),
  brands: z.array(adaptiveValueSchema).max(30).default([]),
  services: z.array(adaptiveValueSchema).max(8).default([]),
  sampleProduct: optionalText.default(null),
  samplePriceNgn: z.number().int().min(100).max(100_000_000).nullable().default(null),
  websiteField: z.string().max(0).optional(),
});

export const saveRetailerPartnershipSchema = z.object({
  revision: z.number().int().min(0),
  draft: retailerPartnershipDraftSchema,
  websiteField: z.string().max(0).optional(),
}).strict();

export function emptyRetailerPartnershipDraft(): RetailerPartnershipDraft {
  return {
    storeName: '',
    channels: [],
    state: [],
    city: '',
    address: null,
    email: '',
    phone: null,
    whatsapp: null,
    website: null,
    instagram: null,
    facebook: null,
    brands: [],
    services: [],
    sampleProduct: null,
    samplePriceNgn: null,
    contactConsent: true,
    currentStep: 1,
  };
}
