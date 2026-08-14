import { z } from "zod";
import { BASKET_MAX_PRODUCTS, BASKET_MAX_QUANTITY } from "./basket";

const basketLineSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  quantity: z.number().int().min(1).max(BASKET_MAX_QUANTITY),
});

export const createAssistedOrderSchema = z.object({
  requestId: z.uuid(),
  retailer: z.string().trim().min(2).max(160),
  lines: z
    .array(basketLineSchema)
    .min(1)
    .max(BASKET_MAX_PRODUCTS)
    .refine(
      (lines) => new Set(lines.map((line) => line.slug)).size === lines.length,
      "Each exact product can appear once.",
    ),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z
    .email()
    .trim()
    .max(320)
    .transform((value) => value.toLocaleLowerCase("en")),
  contactPhone: z.string().trim().min(7).max(40),
  deliveryAddress: z.string().trim().min(5).max(500),
  deliveryCity: z.string().trim().min(2).max(120),
  deliveryState: z.string().trim().min(2).max(120),
  deliveryInstructions: z.string().trim().max(500).optional().default(""),
  whatsappConsent: z.boolean().default(false),
  emailNotificationsConsent: z.boolean().default(false),
  termsAccepted: z.literal(true),
  websiteField: z.string().max(0).optional().default(""),
});

export type CreateAssistedOrderInput = z.infer<
  typeof createAssistedOrderSchema
>;

const moneyComponent = z.number().min(0).max(100_000_000);

export const submitAssistedQuoteSchema = z.object({
  orderId: z.uuid(),
  revision: z.number().int().positive(),
  productSubtotalNgn: moneyComponent,
  retailerFeeNgn: moneyComponent,
  taxNgn: moneyComponent,
  jelocareFeeNgn: moneyComponent,
  deliveryNgn: moneyComponent,
  evidenceReference: z.string().trim().min(8).max(1000),
  notes: z.string().trim().max(1000).optional().default(""),
  expiresAt: z.iso.datetime(),
  serviceFeePolicyId: z.uuid().nullable().optional(),
  serviceFeePolicyResolvedNgn: z.number().min(0).nullable().optional(),
});

export const customerQuoteDecisionSchema = z.object({
  orderId: z.uuid().optional(),
  quoteVersion: z.number().int().positive(),
  orderRevision: z.number().int().positive(),
  decision: z.enum(["approve", "decline"]),
  reason: z.string().trim().max(500).optional().default(""),
});

export const assistedOrderRecoveryRequestSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^JC-[A-Z0-9]{10}$/),
  contactEmail: z
    .email()
    .trim()
    .max(320)
    .transform((value) => value.toLocaleLowerCase("en")),
});

export const assistedOrderNotificationPreferenceSchema = z.object({
  orderId: z.uuid().optional(),
  enabled: z.boolean(),
});

export const customerReturnRequestSchema = z.object({
  orderId: z.uuid().optional(),
  orderRevision: z.number().int().positive(),
  reason: z.string().trim().min(10).max(1000),
});
