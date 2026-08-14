import { z } from "zod";
import { money } from "@/lib/format/money";
import {
  adaptiveValueSchema,
  type AdaptiveValue,
} from "@/lib/community-intake/schema";
import type { PendingRetailerApplication } from "@/lib/moderation/queues";

const conciseText = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(z.string().min(1).max(120));

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value ? value.normalize("NFKC").trim() : null))
  .pipe(z.union([z.string().min(1).max(240), z.literal("")]))
  .transform((value) => value || null);

const optionalUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value?.normalize("NFKC").trim() || null)
  .refine((value) => value === null || /^https?:\/\//i.test(value), {
    message: "Use an http or https link.",
  })
  .catch(null);

const ngnAmount = z
  .union([z.number().min(100).max(100_000_000), z.null(), z.undefined()])
  .transform((value) => value ?? null);

const adaptiveValues = z.array(adaptiveValueSchema).catch([]);

const retailerApplicationPayloadSchema = z.object({
  storeName: conciseText.catch(""),
  channels: adaptiveValues,
  state: adaptiveValues,
  city: conciseText.catch(""),
  address: optionalText,
  email: z.string().email().catch(""),
  phone: optionalText,
  whatsapp: optionalText,
  website: optionalUrl,
  instagram: optionalText,
  facebook: optionalText,
  brands: adaptiveValues,
  services: adaptiveValues,
  sampleProduct: optionalText,
  samplePriceNgn: ngnAmount,
});

export type RetailerApplicationReviewItem = {
  id: string;
  storeName: string;
  email: string;
  emailVerifiedAt: string | null;
  emailStatusLabel: "Verified" | "Unverified";
  submittedAt: string;
  location: {
    city: string | null;
    state: string | null;
    address: string | null;
    display: string;
  };
  channels: string[];
  services: string[];
  brands: string[];
  phone: {
    display: string | null;
    href: string | null;
  };
  whatsapp: {
    display: string | null;
    href: string | null;
  };
  website: {
    display: string | null;
    href: string | null;
  };
  instagram: {
    display: string | null;
    href: string | null;
  };
  facebook: {
    display: string | null;
    href: string | null;
  };
  sample: {
    product: string | null;
    priceDisplay: string | null;
  };
  metadata: {
    applicationId: string;
  };
};

function normalizePhone(value: string | null): {
  display: string | null;
  href: string | null;
} {
  if (!value) return { display: null, href: null };
  const cleaned = value.replace(/[^0-9+]/g, "");
  return cleaned
    ? { display: value, href: `tel:${cleaned}` }
    : { display: value, href: null };
}

function normalizeWhatsApp(value: string | null): {
  display: string | null;
  href: string | null;
} {
  if (!value) return { display: null, href: null };
  const digits = value.replace(/[^0-9]/g, "");
  return digits
    ? { display: value, href: `https://wa.me/${digits}` }
    : { display: value, href: null };
}

function normalizeInstagram(value: string | null): {
  display: string | null;
  href: string | null;
} {
  if (!value) return { display: null, href: null };
  const cleaned = value.replace("@", "").trim();
  return cleaned
    ? { display: `@${cleaned}`, href: `https://instagram.com/${cleaned}` }
    : { display: value, href: null };
}

function normalizeWebsite(value: string | null): {
  display: string | null;
  href: string | null;
} {
  if (!value) return { display: null, href: null };
  const trimmed = value.trim();
  if (!trimmed) return { display: null, href: null };
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { display: trimmed, href };
}

function labelList(values: AdaptiveValue[]): string[] {
  return values.map((value) => value.label);
}

function locationDisplay(
  city: string | null,
  state: string | null,
  address: string | null,
): string {
  if (address && city) return `${address}, ${city}`;
  if (address) return address;
  if (city && state) return `${city}, ${state}`;
  return city || state || "—";
}

export function retailerApplicationReviewItem(
  record: PendingRetailerApplication,
): RetailerApplicationReviewItem {
  const parsed = retailerApplicationPayloadSchema.safeParse(record.payload);
  const payload = parsed.success
    ? parsed.data
    : {
        storeName: record.storeName,
        channels: [] as AdaptiveValue[],
        state: [] as AdaptiveValue[],
        city: "",
        address: null as string | null,
        email: record.email,
        phone: null as string | null,
        whatsapp: null as string | null,
        website: null as string | null,
        instagram: null as string | null,
        facebook: null as string | null,
        brands: [] as AdaptiveValue[],
        services: [] as AdaptiveValue[],
        sampleProduct: null as string | null,
        samplePriceNgn: null as number | null,
      };

  const city = payload.city || null;
  const state = payload.state[0]?.label ?? null;
  const address = payload.address;

  const samplePrice = payload.samplePriceNgn
    ? `(${money(payload.samplePriceNgn)})`
    : null;

  return {
    id: record.id,
    storeName: record.storeName || payload.storeName,
    email: record.email,
    emailVerifiedAt: record.emailVerifiedAt,
    emailStatusLabel: record.emailVerifiedAt ? "Verified" : "Unverified",
    submittedAt: record.submittedAt,
    location: {
      city,
      state,
      address,
      display: locationDisplay(city, state, address),
    },
    channels: labelList(payload.channels),
    services: labelList(payload.services),
    brands: labelList(payload.brands),
    phone: normalizePhone(payload.phone),
    whatsapp: normalizeWhatsApp(payload.whatsapp),
    website: normalizeWebsite(payload.website),
    instagram: normalizeInstagram(payload.instagram),
    facebook: {
      display: payload.facebook,
      href: payload.facebook
        ? `https://facebook.com/${payload.facebook}`
        : null,
    },
    sample: {
      product: payload.sampleProduct,
      priceDisplay: samplePrice,
    },
    metadata: {
      applicationId: record.id,
    },
  };
}
