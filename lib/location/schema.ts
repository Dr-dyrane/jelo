import { z } from "zod";
import { NIGERIA_STATES } from "./nigeria";

const nigeriaStateSchema = z.enum(NIGERIA_STATES);

export const smartLocationSuggestionRequestSchema = z.object({
  query: z.string().trim().min(4).max(160),
  city: z.string().trim().max(120).optional().default(""),
  state: nigeriaStateSchema.optional(),
});

export const savedCustomerLocationInputSchema = z.object({
  id: z.uuid().optional(),
  revision: z.number().int().nonnegative().optional(),
  label: z.string().trim().min(2).max(60),
  kind: z.enum(["delivery", "billing"]),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(120),
  state: nigeriaStateSchema,
  postalCode: z.string().trim().max(20).optional().default(""),
  isDefault: z.boolean().default(false),
});

export type SavedCustomerLocationInput = z.infer<
  typeof savedCustomerLocationInputSchema
>;
