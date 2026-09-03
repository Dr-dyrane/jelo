import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres, { type Sql } from "postgres";
import { z, ZodError } from "zod";
import { requireAdminDatabaseUrl } from "./lib/admin-database";

const MAX_MANIFEST_BYTES = 64 * 1024;
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";
const FORBIDDEN_PUBLIC_CHARACTERS =
  /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
const PLACEHOLDER_PUBLIC_WORDS =
  /\b(?:demo|example|fake|fixture|placeholder|sample|test)\b/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const evidenceMaximumDays = {
  field_visit: 180,
  retailer_confirmation: 90,
  branch_online_record: 30,
  partnership_application: 90,
  community_report: 30,
  online_listing: 30,
  map_result: 30,
  social_profile: 30,
  search_result: 7,
  old_receipt: 7,
} as const;

const productObservationMaximumDays = {
  field_visit: 14,
  retailer_confirmation: 7,
  branch_online_record: 3,
} as const;

type EvidenceSourceMethod = keyof typeof evidenceMaximumDays;
type ProductObservationSourceMethod =
  keyof typeof productObservationMaximumDays;
type PlannedAction =
  | "create-and-approve"
  | "create-and-publish"
  | "create-and-verify"
  | "create-pending"
  | "approve"
  | "publish"
  | "verify"
  | "unchanged";

type TransactionSql = Sql & {
  begin?: <T>(
    options: string,
    run: (transaction: Sql) => Promise<T>,
  ) => Promise<T>;
};

class OnboardingConflictError extends Error {}

const exactUuidSchema = z
  .uuid()
  .refine((value) => value !== UUID_ZERO, "A non-zero UUID is required.")
  .refine((value) => value === value.toLowerCase(), {
    message: "Use the canonical lowercase UUID form.",
  });

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(SLUG_PATTERN, "Use an exact lowercase hyphenated slug.");

function exactTextSchema(maximumLength: number, publicValue = false) {
  let schema = z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => value === value.trim(), {
      message: "Surrounding whitespace is not allowed.",
    })
    .refine((value) => !FORBIDDEN_PUBLIC_CHARACTERS.test(value), {
      message: "Control and directional formatting characters are not allowed.",
    });
  if (publicValue) {
    schema = schema.refine((value) => !PLACEHOLDER_PUBLIC_WORDS.test(value), {
      message: "Placeholder public data is not allowed.",
    });
  }
  return schema;
}

const sourceMethodSchema = z.enum(
  Object.keys(evidenceMaximumDays) as [
    EvidenceSourceMethod,
    ...EvidenceSourceMethod[],
  ],
);
const locationIdentitySourceMethodSchema = z.enum([
  "field_visit",
  "retailer_confirmation",
  "branch_online_record",
  "partnership_application",
]);

const evidenceSchema = z
  .object({
    id: exactUuidSchema,
    sourceMethod: sourceMethodSchema,
    sourceReference: exactTextSchema(500),
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

const identityEvidenceSchema = evidenceSchema.extend({
  sourceMethod: locationIdentitySourceMethodSchema,
});

const initialObservationSchema = z
  .object({
    id: exactUuidSchema,
    availability: z.enum([
      "in_stock",
      "low_stock",
      "out_of_stock",
      "unknown",
      "not_carried",
    ]),
    priceNgn: z
      .number()
      .positive()
      .max(9_999_999_999.99)
      .multipleOf(0.01)
      .nullable()
      .default(null),
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    sourceMethod: z.enum([
      "field_visit",
      "retailer_confirmation",
      "branch_online_record",
    ]),
    sourceReference: exactTextSchema(500),
    observedTitle: exactTextSchema(240, true),
    observedSize: exactTextSchema(80, true),
  })
  .strict();

const channelSchema = z
  .object({
    id: exactUuidSchema,
    kind: z.enum(["phone", "whatsapp", "website", "social_business_profile"]),
    publicDestination: exactTextSchema(500, true),
    expiresAt: z.iso.datetime(),
    ownershipEvidence: evidenceSchema,
  })
  .strict()
  .superRefine((channel, context) => {
    if (!isSafePublicDestination(channel.kind, channel.publicDestination)) {
      context.addIssue({
        code: "custom",
        path: ["publicDestination"],
        message: "The channel destination is not a safe public action.",
      });
    }
  });

const onboardingManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    reviewedAt: z.iso.datetime(),
    rationale: exactTextSchema(2000),
    retailer: z
      .object({
        id: exactUuidSchema,
        slug: slugSchema,
      })
      .strict(),
    product: z
      .object({
        identityVersionId: exactUuidSchema,
        productId: exactUuidSchema,
        slug: slugSchema,
      })
      .strict()
      .optional(),
    market: z
      .object({
        id: exactUuidSchema,
        slug: slugSchema,
        publicName: exactTextSchema(160, true),
        city: exactTextSchema(120, true),
        stateRegion: exactTextSchema(120, true),
        countryCode: z.string().regex(/^[A-Z]{2}$/),
      })
      .strict(),
    place: z
      .object({
        id: exactUuidSchema,
        slug: slugSchema,
        kind: z.enum([
          "entrance",
          "zone",
          "plaza",
          "section",
          "floor",
          "landmark",
        ]),
        publicName: exactTextSchema(160, true),
        reviewedAliases: z
          .array(exactTextSchema(160, true))
          .max(20)
          .default([]),
        parentPlaceId: exactUuidSchema.nullable().default(null),
      })
      .strict()
      .optional(),
    location: z
      .object({
        id: exactUuidSchema,
        slug: slugSchema,
        publicName: exactTextSchema(160, true),
        shopNumber: exactTextSchema(80, true).nullable().default(null),
        floor: exactTextSchema(80, true).nullable().default(null),
        verificationExpiresAt: z.iso.datetime(),
        identityEvidence: identityEvidenceSchema,
        publicDirections: z
          .object({
            text: exactTextSchema(500, true),
            evidence: evidenceSchema,
          })
          .strict()
          .optional(),
        channel: channelSchema.optional(),
      })
      .strict()
      .refine(
        (location) =>
          location.publicDirections !== undefined ||
          location.channel !== undefined,
        {
          message:
            "A pilot location needs reviewed public directions or one verified public channel.",
        },
      ),
    initialObservation: initialObservationSchema.optional(),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.initialObservation && !manifest.product) {
      context.addIssue({
        code: "custom",
        path: ["product"],
        message:
          "An exact product identity is required when initialObservation is provided.",
      });
    }

    const aliases = manifest.place?.reviewedAliases ?? [];
    const normalizedAliases = aliases.map((alias) => alias.toLocaleLowerCase());
    if (new Set(normalizedAliases).size !== normalizedAliases.length) {
      context.addIssue({
        code: "custom",
        path: ["place", "reviewedAliases"],
        message: "Reviewed aliases must be unique.",
      });
    }

    if (manifest.place && manifest.place.parentPlaceId === manifest.place.id) {
      context.addIssue({
        code: "custom",
        path: ["place", "parentPlaceId"],
        message: "A place cannot be its own parent.",
      });
    }

    const createdIds = [
      manifest.market.id,
      manifest.place?.id,
      manifest.location.id,
      manifest.location.identityEvidence.id,
      manifest.location.publicDirections?.evidence.id,
      manifest.location.channel?.id,
      manifest.location.channel?.ownershipEvidence.id,
      manifest.initialObservation?.id,
    ].filter((value): value is string => value !== undefined);
    if (new Set(createdIds).size !== createdIds.length) {
      context.addIssue({
        code: "custom",
        path: ["location"],
        message: "Every planned canonical row requires a distinct UUID.",
      });
    }
  });

export type MarketFinderOnboardingManifest = z.infer<
  typeof onboardingManifestSchema
>;

export type MarketFinderOnboardingCommand = {
  manifestPath: string;
  apply: boolean;
};

type OnboardingPlan = {
  retailerId: string;
  product: {
    identityVersionId: string;
    productId: string;
  } | null;
  market: { id: string; action: PlannedAction };
  place: { id: string; action: PlannedAction } | null;
  location: { id: string; action: PlannedAction };
  identityEvidence: { id: string; action: PlannedAction };
  directionsEvidence: { id: string; action: PlannedAction } | null;
  channel: { id: string; action: PlannedAction } | null;
  channelEvidence: { id: string; action: PlannedAction } | null;
  initialObservation: {
    id: string;
    action: "create-pending" | "unchanged";
    state: "pending" | "approved";
  } | null;
};

type ExistingRetailerRow = { id: string; slug: string };
type ExistingProductRow = {
  identity_version_id: string;
  product_id: string;
  lifecycle_state: string;
  product_slug: string;
  is_published: boolean;
};
type ExistingMarketRow = {
  id: string;
  slug: string;
  public_name: string;
  city: string;
  state_region: string;
  country_code: string;
  publication_state: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};
type ExistingPlaceRow = {
  id: string;
  market_id: string;
  parent_place_id: string | null;
  slug: string;
  place_kind: string;
  public_name: string;
  reviewed_aliases: string[];
  place_state: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};
type ExistingLocationRow = {
  id: string;
  retailer_id: string;
  market_id: string | null;
  primary_place_id: string | null;
  slug: string;
  public_name: string;
  shop_number: string | null;
  floor: string | null;
  public_directions: string | null;
  location_state: string;
  verified_at: Date | string | null;
  verification_expires_at: Date | string | null;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};
type ExistingEvidenceRow = {
  id: string;
  retailer_location_id: string;
  channel_id: string | null;
  evidence_scope: string;
  source_method: string;
  source_reference: string;
  observed_at: Date | string;
  expires_at: Date | string;
  decision: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};
type ExistingChannelRow = {
  id: string;
  retailer_location_id: string;
  channel_kind: string;
  public_destination: string;
  channel_state: string;
  source_method: string;
  source_reference: string;
  verified_at: Date | string | null;
  expires_at: Date | string | null;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};
type ExistingObservationRow = {
  id: string;
  retailer_location_id: string;
  product_identity_version_id: string;
  availability: string;
  price_ngn: string | number | null;
  observed_at: Date | string;
  expires_at: Date | string;
  source_method: string;
  source_reference: string;
  observed_title: string;
  observed_size: string;
  moderation_status: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
};

function isSafePublicHttpsUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return false;
  }
  const host = parsed.hostname.toLocaleLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.includes(":") ||
    /^\d+(?:\.\d+){3}$/.test(host)
  ) {
    return false;
  }
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
    host,
  );
}

function isSafePublicDestination(kind: string, value: string) {
  if (kind === "phone") return /^tel:\+[1-9]\d{7,14}$/.test(value);
  if (kind === "whatsapp") {
    return /^https:\/\/wa\.me\/[1-9]\d{7,14}$/.test(value);
  }
  return isSafePublicHttpsUrl(value);
}

function timestamp(value: string) {
  return Date.parse(value);
}

function datesEqual(actual: Date | string | null, expected: string) {
  if (actual === null) return false;
  const actualDate = actual instanceof Date ? actual : new Date(actual);
  return (
    Number.isFinite(actualDate.getTime()) &&
    actualDate.toISOString() === new Date(expected).toISOString()
  );
}

function addValidationIssue(
  issues: string[],
  condition: boolean,
  pathLabel: string,
  message: string,
) {
  if (!condition) issues.push(`${pathLabel}: ${message}`);
}

function validateEvidenceWindow(
  evidence: z.infer<typeof evidenceSchema>,
  reviewedAt: number,
  currentAt: number,
  pathLabel: string,
  issues: string[],
) {
  const observedAt = timestamp(evidence.observedAt);
  const expiresAt = timestamp(evidence.expiresAt);
  addValidationIssue(
    issues,
    observedAt <= reviewedAt,
    `${pathLabel}.observedAt`,
    "must not be later than reviewedAt",
  );
  addValidationIssue(
    issues,
    expiresAt > reviewedAt,
    `${pathLabel}.expiresAt`,
    "must be current at review time",
  );
  addValidationIssue(
    issues,
    expiresAt > currentAt,
    `${pathLabel}.expiresAt`,
    "must be current at operator time",
  );
  addValidationIssue(
    issues,
    expiresAt <=
      observedAt + evidenceMaximumDays[evidence.sourceMethod] * 86_400_000,
    `${pathLabel}.expiresAt`,
    "exceeds the source-specific maximum window",
  );
}

export function parseMarketFinderOnboardingManifest(
  input: unknown,
  now = new Date(),
): MarketFinderOnboardingManifest {
  const manifest = onboardingManifestSchema.parse(input);
  if (!Number.isFinite(now.getTime())) {
    throw new Error("A valid operator clock is required.");
  }

  const issues: string[] = [];
  const reviewedAt = timestamp(manifest.reviewedAt);
  const currentAt = now.getTime();
  addValidationIssue(
    issues,
    reviewedAt <= currentAt,
    "reviewedAt",
    "must not be future-dated",
  );
  validateEvidenceWindow(
    manifest.location.identityEvidence,
    reviewedAt,
    currentAt,
    "location.identityEvidence",
    issues,
  );
  const verificationExpiresAt = timestamp(
    manifest.location.verificationExpiresAt,
  );
  addValidationIssue(
    issues,
    verificationExpiresAt > reviewedAt,
    "location.verificationExpiresAt",
    "must be later than reviewedAt",
  );
  addValidationIssue(
    issues,
    verificationExpiresAt > currentAt,
    "location.verificationExpiresAt",
    "must be current at operator time",
  );
  addValidationIssue(
    issues,
    verificationExpiresAt <=
      timestamp(manifest.location.identityEvidence.expiresAt),
    "location.verificationExpiresAt",
    "must be covered by identity evidence",
  );

  if (manifest.location.publicDirections) {
    const evidence = manifest.location.publicDirections.evidence;
    validateEvidenceWindow(
      evidence,
      reviewedAt,
      currentAt,
      "location.publicDirections.evidence",
      issues,
    );
    addValidationIssue(
      issues,
      timestamp(evidence.expiresAt) >= verificationExpiresAt,
      "location.publicDirections.evidence.expiresAt",
      "must cover the location verification window",
    );
  }

  if (manifest.location.channel) {
    const channel = manifest.location.channel;
    validateEvidenceWindow(
      channel.ownershipEvidence,
      reviewedAt,
      currentAt,
      "location.channel.ownershipEvidence",
      issues,
    );
    const channelExpiresAt = timestamp(channel.expiresAt);
    addValidationIssue(
      issues,
      channelExpiresAt > reviewedAt,
      "location.channel.expiresAt",
      "must be later than reviewedAt",
    );
    addValidationIssue(
      issues,
      channelExpiresAt > currentAt,
      "location.channel.expiresAt",
      "must be current at operator time",
    );
    addValidationIssue(
      issues,
      channelExpiresAt <= verificationExpiresAt,
      "location.channel.expiresAt",
      "must not outlive the verified location",
    );
    addValidationIssue(
      issues,
      channelExpiresAt <= timestamp(channel.ownershipEvidence.expiresAt),
      "location.channel.expiresAt",
      "must be covered by ownership evidence",
    );
  }

  if (manifest.initialObservation) {
    const observation = manifest.initialObservation;
    const observedAt = timestamp(observation.observedAt);
    const expiresAt = timestamp(observation.expiresAt);
    const sourceMethod =
      observation.sourceMethod as ProductObservationSourceMethod;
    addValidationIssue(
      issues,
      observedAt <= reviewedAt,
      "initialObservation.observedAt",
      "must not be later than reviewedAt",
    );
    addValidationIssue(
      issues,
      expiresAt > reviewedAt,
      "initialObservation.expiresAt",
      "must be current at review time",
    );
    addValidationIssue(
      issues,
      expiresAt > currentAt,
      "initialObservation.expiresAt",
      "must be current at operator time",
    );
    addValidationIssue(
      issues,
      expiresAt <=
        observedAt + productObservationMaximumDays[sourceMethod] * 86_400_000,
      "initialObservation.expiresAt",
      "exceeds the source-specific maximum window",
    );
  }

  if (issues.length > 0) {
    throw new OnboardingConflictError(
      `Market Finder onboarding manifest has unsafe date windows: ${issues.join("; ")}.`,
    );
  }
  return manifest;
}

export function parseMarketFinderOnboardingCommand(
  args: string[],
): MarketFinderOnboardingCommand {
  let manifestPath: string | null = null;
  let apply = false;
  for (const argument of args) {
    if (argument === "--apply") {
      if (apply) throw new Error("--apply may be provided only once.");
      apply = true;
      continue;
    }
    if (argument.startsWith("--manifest=")) {
      if (manifestPath !== null) {
        throw new Error("--manifest may be provided only once.");
      }
      const suppliedPath = argument.slice("--manifest=".length);
      if (!suppliedPath)
        throw new Error("--manifest requires a JSON file path.");
      manifestPath = path.resolve(suppliedPath);
      continue;
    }
    throw new Error("Unknown Market Finder onboarding option.");
  }
  if (manifestPath === null) {
    throw new Error("--manifest is required.");
  }
  return { manifestPath, apply };
}

export async function readMarketFinderOnboardingManifest(
  manifestPath: string,
  now = new Date(),
) {
  const bytes = await readFile(manifestPath);
  if (bytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error("Market Finder onboarding manifest exceeds 64 KiB.");
  }
  let input: unknown;
  try {
    input = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Market Finder onboarding manifest is not valid JSON.");
  }
  return parseMarketFinderOnboardingManifest(input, now);
}

export async function resolveMarketFinderOnboardingAdmin(
  sql: Sql,
  operatorEmail: string | undefined,
) {
  const parsedEmail = z.email().safeParse(operatorEmail);
  if (!parsedEmail.success) {
    throw new Error("MODERATION_OPERATOR_EMAIL must be a valid email address.");
  }
  const rows = await sql<{ auth_subject: string; role: string }[]>`
    select auth_subject, role
    from moderation_operators
    where lower(email) = lower(${parsedEmail.data})
      and active = true
    limit 2
  `;
  if (rows.length !== 1 || rows[0].role !== "admin") {
    throw new Error(
      "MODERATION_OPERATOR_EMAIL must identify exactly one active admin.",
    );
  }
  return rows[0].auth_subject;
}

function requireExactSingleRow<T>(
  rows: T[],
  matches: (row: T) => boolean,
  label: string,
) {
  if (rows.length !== 1 || !matches(rows[0])) {
    throw new OnboardingConflictError(
      `${label} is missing or conflicts with an existing canonical identity.`,
    );
  }
  return rows[0];
}

function requireUnreviewed(
  row: { reviewed_by: string | null; reviewed_at: Date | string | null },
  label: string,
) {
  if (row.reviewed_by !== null || row.reviewed_at !== null) {
    throw new OnboardingConflictError(
      `${label} has an incompatible partial review state.`,
    );
  }
}

async function planMarket(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan["market"]> {
  const rows = await sql<ExistingMarketRow[]>`
    select id, slug, public_name, city, state_region, country_code,
      publication_state, reviewed_by, reviewed_at
    from physical_markets
    where id = ${manifest.market.id} or slug = ${manifest.market.slug}
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return { id: manifest.market.id, action: "create-and-publish" };
  }
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === manifest.market.id &&
      candidate.slug === manifest.market.slug &&
      candidate.public_name === manifest.market.publicName &&
      candidate.city === manifest.market.city &&
      candidate.state_region === manifest.market.stateRegion &&
      candidate.country_code === manifest.market.countryCode,
    "Physical market",
  );
  if (row.publication_state === "draft") {
    requireUnreviewed(row, "Physical market");
    return { id: row.id, action: "publish" };
  }
  if (
    row.publication_state === "published" &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged" };
  }
  throw new OnboardingConflictError(
    "Physical market is not in an onboardable publication state.",
  );
}

async function planPlace(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan["place"]> {
  const place = manifest.place;
  if (!place) return null;
  if (place.parentPlaceId) {
    const parents = await sql<
      { id: string; market_id: string; place_state: string }[]
    >`
      select id, market_id, place_state
      from physical_market_places
      where id = ${place.parentPlaceId}
      limit 1
    `;
    requireExactSingleRow(
      parents,
      (parent) =>
        parent.id === place.parentPlaceId &&
        parent.market_id === manifest.market.id &&
        parent.place_state === "verified",
      "Parent market place",
    );
  }
  const rows = await sql<ExistingPlaceRow[]>`
    select id, market_id, parent_place_id, slug, place_kind, public_name,
      reviewed_aliases, place_state, reviewed_by, reviewed_at
    from physical_market_places
    where id = ${place.id}
      or (market_id = ${manifest.market.id} and slug = ${place.slug})
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return { id: place.id, action: "create-and-verify" };
  }
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === place.id &&
      candidate.market_id === manifest.market.id &&
      candidate.parent_place_id === place.parentPlaceId &&
      candidate.slug === place.slug &&
      candidate.place_kind === place.kind &&
      candidate.public_name === place.publicName &&
      JSON.stringify(candidate.reviewed_aliases) ===
        JSON.stringify(place.reviewedAliases),
    "Physical market place",
  );
  if (row.place_state === "lead") {
    requireUnreviewed(row, "Physical market place");
    return { id: row.id, action: "verify" };
  }
  if (
    row.place_state === "verified" &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged" };
  }
  throw new OnboardingConflictError(
    "Physical market place is not in an onboardable review state.",
  );
}

async function planLocation(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan["location"]> {
  const location = manifest.location;
  const rows = await sql<ExistingLocationRow[]>`
    select id, retailer_id, market_id, primary_place_id, slug, public_name,
      shop_number, floor, public_directions, location_state, verified_at,
      verification_expires_at, reviewed_by, reviewed_at
    from retailer_locations
    where id = ${location.id}
      or (market_id = ${manifest.market.id} and slug = ${location.slug})
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return { id: location.id, action: "create-and-verify" };
  }
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === location.id &&
      candidate.retailer_id === manifest.retailer.id &&
      candidate.market_id === manifest.market.id &&
      candidate.primary_place_id === (manifest.place?.id ?? null) &&
      candidate.slug === location.slug &&
      candidate.public_name === location.publicName &&
      candidate.shop_number === location.shopNumber &&
      candidate.floor === location.floor &&
      candidate.public_directions === (location.publicDirections?.text ?? null),
    "Retailer location",
  );
  if (row.location_state === "lead") {
    requireUnreviewed(row, "Retailer location");
    if (row.verified_at !== null || row.verification_expires_at !== null) {
      throw new OnboardingConflictError(
        "Retailer location has an incompatible partial verification window.",
      );
    }
    return { id: row.id, action: "verify" };
  }
  if (
    row.location_state === "verified" &&
    row.verified_at !== null &&
    datesEqual(row.verification_expires_at, location.verificationExpiresAt) &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged" };
  }
  throw new OnboardingConflictError(
    "Retailer location is not in the exact onboardable verification state.",
  );
}

async function planEvidence(
  sql: Sql,
  input: {
    locationId: string;
    channelId: string | null;
    scope: "location_identity" | "channel_ownership" | "public_directions";
    evidence: z.infer<typeof evidenceSchema>;
  },
): Promise<{ id: string; action: PlannedAction }> {
  const rows = await sql<ExistingEvidenceRow[]>`
    select id, retailer_location_id, channel_id, evidence_scope, source_method,
      source_reference, observed_at, expires_at, decision, reviewed_by, reviewed_at
    from retailer_location_evidence
    where id = ${input.evidence.id}
      or (
        retailer_location_id = ${input.locationId}
        and evidence_scope = ${input.scope}
        and coalesce(channel_id, ${UUID_ZERO}::uuid) =
          coalesce(${input.channelId}::uuid, ${UUID_ZERO}::uuid)
        and source_method = ${input.evidence.sourceMethod}
        and source_reference = ${input.evidence.sourceReference}
      )
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return { id: input.evidence.id, action: "create-and-approve" };
  }
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === input.evidence.id &&
      candidate.retailer_location_id === input.locationId &&
      candidate.channel_id === input.channelId &&
      candidate.evidence_scope === input.scope &&
      candidate.source_method === input.evidence.sourceMethod &&
      candidate.source_reference === input.evidence.sourceReference &&
      datesEqual(candidate.observed_at, input.evidence.observedAt) &&
      datesEqual(candidate.expires_at, input.evidence.expiresAt),
    "Retailer location evidence",
  );
  if (row.decision === "pending") {
    requireUnreviewed(row, "Retailer location evidence");
    return { id: row.id, action: "approve" };
  }
  if (
    row.decision === "approved" &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged" };
  }
  throw new OnboardingConflictError(
    "Retailer location evidence is not in an onboardable decision state.",
  );
}

async function planChannel(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan["channel"]> {
  const channel = manifest.location.channel;
  if (!channel) return null;
  const rows = await sql<ExistingChannelRow[]>`
    select id, retailer_location_id, channel_kind, public_destination,
      channel_state, source_method, source_reference, verified_at, expires_at,
      reviewed_by, reviewed_at
    from retailer_location_channels
    where id = ${channel.id}
      or (
        retailer_location_id = ${manifest.location.id}
        and channel_kind = ${channel.kind}
        and public_destination = ${channel.publicDestination}
      )
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return { id: channel.id, action: "create-and-verify" };
  }
  const evidence = channel.ownershipEvidence;
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === channel.id &&
      candidate.retailer_location_id === manifest.location.id &&
      candidate.channel_kind === channel.kind &&
      candidate.public_destination === channel.publicDestination &&
      candidate.source_method === evidence.sourceMethod &&
      candidate.source_reference === evidence.sourceReference,
    "Retailer location channel",
  );
  if (row.channel_state === "pending") {
    requireUnreviewed(row, "Retailer location channel");
    if (row.verified_at !== null || row.expires_at !== null) {
      throw new OnboardingConflictError(
        "Retailer location channel has an incompatible partial verification window.",
      );
    }
    return { id: row.id, action: "verify" };
  }
  if (
    row.channel_state === "verified" &&
    row.verified_at !== null &&
    datesEqual(row.expires_at, channel.expiresAt) &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged" };
  }
  throw new OnboardingConflictError(
    "Retailer location channel is not in the exact onboardable verification state.",
  );
}

function pricesEqual(
  actual: string | number | null,
  expected: number | null,
): boolean {
  if (actual === null || expected === null) return actual === expected;
  const numeric = Number(actual);
  return Number.isFinite(numeric) && numeric === expected;
}

async function planInitialObservation(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan["initialObservation"]> {
  const observation = manifest.initialObservation;
  if (!observation) return null;
  const product = manifest.product;
  if (!product) {
    throw new OnboardingConflictError(
      "An exact product identity is required for an initial observation.",
    );
  }
  const rows = await sql<ExistingObservationRow[]>`
    select id, retailer_location_id, product_identity_version_id,
      availability, price_ngn, observed_at, expires_at, source_method,
      source_reference, observed_title, observed_size, moderation_status,
      reviewed_by, reviewed_at
    from physical_product_observations
    where id = ${observation.id}
      or (
        retailer_location_id = ${manifest.location.id}
        and product_identity_version_id = ${product.identityVersionId}
        and source_method = ${observation.sourceMethod}
        and source_reference = ${observation.sourceReference}
      )
    order by id
    limit 2
  `;
  if (rows.length === 0) {
    return {
      id: observation.id,
      action: "create-pending",
      state: "pending",
    };
  }
  const row = requireExactSingleRow(
    rows,
    (candidate) =>
      candidate.id === observation.id &&
      candidate.retailer_location_id === manifest.location.id &&
      candidate.product_identity_version_id === product.identityVersionId &&
      candidate.availability === observation.availability &&
      pricesEqual(candidate.price_ngn, observation.priceNgn) &&
      datesEqual(candidate.observed_at, observation.observedAt) &&
      datesEqual(candidate.expires_at, observation.expiresAt) &&
      candidate.source_method === observation.sourceMethod &&
      candidate.source_reference === observation.sourceReference &&
      candidate.observed_title === observation.observedTitle &&
      candidate.observed_size === observation.observedSize,
    "Initial physical product observation",
  );
  if (row.moderation_status === "pending") {
    requireUnreviewed(row, "Initial physical product observation");
    return { id: row.id, action: "unchanged", state: "pending" };
  }
  if (
    row.moderation_status === "approved" &&
    row.reviewed_by !== null &&
    row.reviewed_at !== null
  ) {
    return { id: row.id, action: "unchanged", state: "approved" };
  }
  throw new OnboardingConflictError(
    "Initial physical product observation is not pending or approved.",
  );
}

async function buildOnboardingPlan(
  sql: Sql,
  manifest: MarketFinderOnboardingManifest,
): Promise<OnboardingPlan> {
  const retailers = await sql<ExistingRetailerRow[]>`
    select id, slug
    from retailers
    where id = ${manifest.retailer.id} or slug = ${manifest.retailer.slug}
    order by id
    limit 2
  `;
  const retailer = requireExactSingleRow(
    retailers,
    (candidate) =>
      candidate.id === manifest.retailer.id &&
      candidate.slug === manifest.retailer.slug,
    "Canonical retailer",
  );

  const productInput = manifest.product;
  const product = productInput
    ? requireExactSingleRow(
        await sql<ExistingProductRow[]>`
          select identity_version.identity_version_id, identity_version.product_id,
            identity_version.lifecycle_state, product.slug as product_slug,
            product.is_published
          from catalogue_product_identity_versions identity_version
          join products product on product.id = identity_version.product_id
          where identity_version.identity_version_id = ${productInput.identityVersionId}
            or product.id = ${productInput.productId}
            or product.slug = ${productInput.slug}
          order by identity_version.identity_version_id
          limit 3
        `,
        (candidate) =>
          candidate.identity_version_id === productInput.identityVersionId &&
          candidate.product_id === productInput.productId &&
          candidate.product_slug === productInput.slug &&
          candidate.lifecycle_state === "active" &&
          candidate.is_published === true,
        "Published active exact product identity",
      )
    : null;

  const market = await planMarket(sql, manifest);
  const place = await planPlace(sql, manifest);
  const location = await planLocation(sql, manifest);
  const identityEvidence = await planEvidence(sql, {
    locationId: manifest.location.id,
    channelId: null,
    scope: "location_identity",
    evidence: manifest.location.identityEvidence,
  });
  const directionsEvidence = manifest.location.publicDirections
    ? await planEvidence(sql, {
        locationId: manifest.location.id,
        channelId: null,
        scope: "public_directions",
        evidence: manifest.location.publicDirections.evidence,
      })
    : null;
  const channel = await planChannel(sql, manifest);
  const channelEvidence = manifest.location.channel
    ? await planEvidence(sql, {
        locationId: manifest.location.id,
        channelId: manifest.location.channel.id,
        scope: "channel_ownership",
        evidence: manifest.location.channel.ownershipEvidence,
      })
    : null;
  const initialObservation = await planInitialObservation(sql, manifest);

  return {
    retailerId: retailer.id,
    product: product
      ? {
          identityVersionId: product.identity_version_id,
          productId: product.product_id,
        }
      : null,
    market,
    place,
    location,
    identityEvidence,
    directionsEvidence,
    channel,
    channelEvidence,
    initialObservation,
  };
}

async function requireReturnedRow(rows: { id: string }[], label: string) {
  if (rows.length !== 1) {
    throw new OnboardingConflictError(
      `${label} changed after preflight; the transaction was not applied.`,
    );
  }
}

async function insertEvidence(
  sql: Sql,
  input: {
    locationId: string;
    channelId: string | null;
    scope: "location_identity" | "channel_ownership" | "public_directions";
    evidence: z.infer<typeof evidenceSchema>;
  },
) {
  const rows = await sql<{ id: string }[]>`
    insert into retailer_location_evidence (
      id, retailer_location_id, channel_id, evidence_scope, source_method,
      source_reference, observed_at, expires_at, decision
    ) values (
      ${input.evidence.id}, ${input.locationId}, ${input.channelId},
      ${input.scope}, ${input.evidence.sourceMethod},
      ${input.evidence.sourceReference}, ${input.evidence.observedAt},
      ${input.evidence.expiresAt}, 'pending'
    )
    returning id
  `;
  await requireReturnedRow(rows, "Retailer location evidence insert");
}

async function approveEvidence(
  sql: Sql,
  evidenceId: string,
  operatorSubject: string,
  reviewedAt: string,
) {
  const rows = await sql<{ id: string }[]>`
    update retailer_location_evidence
    set decision = 'approved', reviewed_by = ${operatorSubject},
      reviewed_at = ${reviewedAt}
    where id = ${evidenceId} and decision = 'pending'
    returning id
  `;
  await requireReturnedRow(rows, "Retailer location evidence approval");
}

async function applyOnboardingPlan(
  sql: Sql,
  operatorSubject: string,
  manifest: MarketFinderOnboardingManifest,
  plan: OnboardingPlan,
) {
  let changed = false;
  if (plan.market.action === "create-and-publish") {
    const rows = await sql<{ id: string }[]>`
      insert into physical_markets (
        id, slug, public_name, city, state_region, country_code, publication_state
      ) values (
        ${manifest.market.id}, ${manifest.market.slug},
        ${manifest.market.publicName}, ${manifest.market.city},
        ${manifest.market.stateRegion}, ${manifest.market.countryCode}, 'draft'
      )
      returning id
    `;
    await requireReturnedRow(rows, "Physical market insert");
    changed = true;
  }
  if (
    plan.market.action === "create-and-publish" ||
    plan.market.action === "publish"
  ) {
    const rows = await sql<{ id: string }[]>`
      update physical_markets
      set publication_state = 'published', reviewed_by = ${operatorSubject},
        reviewed_at = ${manifest.reviewedAt}, updated_at = now()
      where id = ${manifest.market.id} and publication_state = 'draft'
      returning id
    `;
    await requireReturnedRow(rows, "Physical market publication");
    changed = true;
  }

  if (manifest.place && plan.place?.action === "create-and-verify") {
    const rows = await sql<{ id: string }[]>`
      insert into physical_market_places (
        id, market_id, parent_place_id, slug, place_kind, public_name,
        reviewed_aliases, place_state
      ) values (
        ${manifest.place.id}, ${manifest.market.id},
        ${manifest.place.parentPlaceId}, ${manifest.place.slug},
        ${manifest.place.kind}, ${manifest.place.publicName},
        ${manifest.place.reviewedAliases}, 'lead'
      )
      returning id
    `;
    await requireReturnedRow(rows, "Physical market place insert");
    changed = true;
  }
  if (
    manifest.place &&
    (plan.place?.action === "create-and-verify" ||
      plan.place?.action === "verify")
  ) {
    const rows = await sql<{ id: string }[]>`
      update physical_market_places
      set place_state = 'verified', reviewed_by = ${operatorSubject},
        reviewed_at = ${manifest.reviewedAt}, updated_at = now()
      where id = ${manifest.place.id} and place_state = 'lead'
      returning id
    `;
    await requireReturnedRow(rows, "Physical market place verification");
    changed = true;
  }

  if (plan.location.action === "create-and-verify") {
    const rows = await sql<{ id: string }[]>`
      insert into retailer_locations (
        id, retailer_id, market_id, primary_place_id, slug, public_name,
        shop_number, floor, public_directions, location_state
      ) values (
        ${manifest.location.id}, ${manifest.retailer.id}, ${manifest.market.id},
        ${manifest.place?.id ?? null}, ${manifest.location.slug},
        ${manifest.location.publicName}, ${manifest.location.shopNumber},
        ${manifest.location.floor},
        ${manifest.location.publicDirections?.text ?? null}, 'lead'
      )
      returning id
    `;
    await requireReturnedRow(rows, "Retailer location insert");
    changed = true;
  }

  const identityEvidenceInput = {
    locationId: manifest.location.id,
    channelId: null,
    scope: "location_identity" as const,
    evidence: manifest.location.identityEvidence,
  };
  if (plan.identityEvidence.action === "create-and-approve") {
    await insertEvidence(sql, identityEvidenceInput);
    changed = true;
  }
  if (
    plan.identityEvidence.action === "create-and-approve" ||
    plan.identityEvidence.action === "approve"
  ) {
    await approveEvidence(
      sql,
      manifest.location.identityEvidence.id,
      operatorSubject,
      manifest.reviewedAt,
    );
    changed = true;
  }

  if (manifest.location.publicDirections && plan.directionsEvidence) {
    const directionsEvidenceInput = {
      locationId: manifest.location.id,
      channelId: null,
      scope: "public_directions" as const,
      evidence: manifest.location.publicDirections.evidence,
    };
    if (plan.directionsEvidence.action === "create-and-approve") {
      await insertEvidence(sql, directionsEvidenceInput);
      changed = true;
    }
    if (
      plan.directionsEvidence.action === "create-and-approve" ||
      plan.directionsEvidence.action === "approve"
    ) {
      await approveEvidence(
        sql,
        manifest.location.publicDirections.evidence.id,
        operatorSubject,
        manifest.reviewedAt,
      );
      changed = true;
    }
  }

  if (
    plan.location.action === "create-and-verify" ||
    plan.location.action === "verify"
  ) {
    const rows = await sql<{ id: string }[]>`
      update retailer_locations
      set location_state = 'verified', verified_at = ${manifest.reviewedAt},
        verification_expires_at = ${manifest.location.verificationExpiresAt},
        reviewed_by = ${operatorSubject}, reviewed_at = ${manifest.reviewedAt},
        updated_at = now()
      where id = ${manifest.location.id} and location_state = 'lead'
      returning id
    `;
    await requireReturnedRow(rows, "Retailer location verification");
    changed = true;
  }

  const channel = manifest.location.channel;
  if (channel && plan.channel?.action === "create-and-verify") {
    const evidence = channel.ownershipEvidence;
    const rows = await sql<{ id: string }[]>`
      insert into retailer_location_channels (
        id, retailer_location_id, channel_kind, public_destination,
        channel_state, source_method, source_reference
      ) values (
        ${channel.id}, ${manifest.location.id}, ${channel.kind},
        ${channel.publicDestination}, 'pending', ${evidence.sourceMethod},
        ${evidence.sourceReference}
      )
      returning id
    `;
    await requireReturnedRow(rows, "Retailer location channel insert");
    changed = true;
  }

  if (channel && plan.channelEvidence) {
    const channelEvidenceInput = {
      locationId: manifest.location.id,
      channelId: channel.id,
      scope: "channel_ownership" as const,
      evidence: channel.ownershipEvidence,
    };
    if (plan.channelEvidence.action === "create-and-approve") {
      await insertEvidence(sql, channelEvidenceInput);
      changed = true;
    }
    if (
      plan.channelEvidence.action === "create-and-approve" ||
      plan.channelEvidence.action === "approve"
    ) {
      await approveEvidence(
        sql,
        channel.ownershipEvidence.id,
        operatorSubject,
        manifest.reviewedAt,
      );
      changed = true;
    }
  }

  if (
    channel &&
    (plan.channel?.action === "create-and-verify" ||
      plan.channel?.action === "verify")
  ) {
    const rows = await sql<{ id: string }[]>`
      update retailer_location_channels
      set channel_state = 'verified', verified_at = ${manifest.reviewedAt},
        expires_at = ${channel.expiresAt}, reviewed_by = ${operatorSubject},
        reviewed_at = ${manifest.reviewedAt}, updated_at = now()
      where id = ${channel.id} and channel_state = 'pending'
      returning id
    `;
    await requireReturnedRow(rows, "Retailer location channel verification");
    changed = true;
  }

  const observation = manifest.initialObservation;
  if (observation && plan.initialObservation?.action === "create-pending") {
    const product = manifest.product;
    if (!product) {
      throw new OnboardingConflictError(
        "An exact product identity is required for an initial observation.",
      );
    }
    const rows = await sql<{ id: string }[]>`
      insert into physical_product_observations (
        id, retailer_location_id, product_identity_version_id, availability,
        price_ngn, observed_at, expires_at, source_method, source_reference,
        observed_title, observed_size, moderation_status
      ) values (
        ${observation.id}, ${manifest.location.id},
        ${product.identityVersionId}, ${observation.availability},
        ${observation.priceNgn}, ${observation.observedAt},
        ${observation.expiresAt}, ${observation.sourceMethod},
        ${observation.sourceReference}, ${observation.observedTitle},
        ${observation.observedSize}, 'pending'
      )
      returning id
    `;
    await requireReturnedRow(
      rows,
      "Initial physical product observation insert",
    );
    await sql`
      insert into moderation_audit_log (
        operator_subject, queue, action, target_ref, canonical_write,
        rationale, metadata
      ) values (
        ${operatorSubject}, 'physical_product_observation', 'promote',
        ${observation.id}, true, ${manifest.rationale},
        ${sql.json({
          operation: "append_pending_pilot_evidence",
          marketId: manifest.market.id,
          retailerLocationId: manifest.location.id,
          productIdentityVersionId: product.identityVersionId,
          availability: observation.availability,
          observedAt: observation.observedAt,
          expiresAt: observation.expiresAt,
          sourceMethod: observation.sourceMethod,
        })}
      )
    `;
    changed = true;
  }

  if (changed) {
    await sql`
      insert into moderation_audit_log (
        operator_subject, queue, action, target_ref, canonical_write,
        rationale, metadata
      ) values (
        ${operatorSubject}, 'retailer_location', 'promote',
        ${manifest.location.id}, true, ${manifest.rationale},
        ${sql.json({
          marketId: manifest.market.id,
          placeId: manifest.place?.id ?? null,
          retailerId: manifest.retailer.id,
          locationId: manifest.location.id,
          ...(manifest.product
            ? { identityVersionId: manifest.product.identityVersionId }
            : {}),
          identityEvidenceId: manifest.location.identityEvidence.id,
          directionsEvidenceId:
            manifest.location.publicDirections?.evidence.id ?? null,
          channelId: manifest.location.channel?.id ?? null,
          channelEvidenceId:
            manifest.location.channel?.ownershipEvidence.id ?? null,
          initialObservationId: manifest.initialObservation?.id ?? null,
        })}
      )
    `;
  }

  return changed;
}

function planHasWrites(plan: OnboardingPlan) {
  return [
    plan.market,
    plan.place,
    plan.location,
    plan.identityEvidence,
    plan.directionsEvidence,
    plan.channel,
    plan.channelEvidence,
    plan.initialObservation,
  ].some((entry) => entry !== null && entry.action !== "unchanged");
}

function boundedResult(
  mode: "applied" | "dry-run",
  plan: OnboardingPlan,
  writes: boolean,
) {
  return {
    mode,
    ready: true,
    writes,
    retailer: { id: plan.retailerId, state: "existing" as const },
    product: plan.product
      ? {
          identityVersionId: plan.product.identityVersionId,
          productId: plan.product.productId,
          state: "active-published" as const,
        }
      : null,
    market: {
      id: plan.market.id,
      state: "published" as const,
      action: plan.market.action,
    },
    place: plan.place
      ? {
          id: plan.place.id,
          state: "verified" as const,
          action: plan.place.action,
        }
      : null,
    location: {
      id: plan.location.id,
      state: "verified" as const,
      action: plan.location.action,
    },
    evidence: {
      locationIdentity: {
        id: plan.identityEvidence.id,
        state: "approved" as const,
        action: plan.identityEvidence.action,
      },
      publicDirections: plan.directionsEvidence
        ? {
            id: plan.directionsEvidence.id,
            state: "approved" as const,
            action: plan.directionsEvidence.action,
          }
        : null,
      channelOwnership: plan.channelEvidence
        ? {
            id: plan.channelEvidence.id,
            state: "approved" as const,
            action: plan.channelEvidence.action,
          }
        : null,
    },
    channel: plan.channel
      ? {
          id: plan.channel.id,
          state: "verified" as const,
          action: plan.channel.action,
        }
      : null,
    initialObservation: plan.initialObservation
      ? {
          id: plan.initialObservation.id,
          state: plan.initialObservation.state,
          action: plan.initialObservation.action,
        }
      : null,
  };
}

export type MarketFinderOnboardingResult = ReturnType<typeof boundedResult>;

export async function runMarketFinderOnboarding(
  sql: Sql,
  untrustedManifest: unknown,
  options: {
    apply?: boolean;
    operatorEmail?: string;
    now?: Date;
  } = {},
): Promise<MarketFinderOnboardingResult> {
  const now = options.now ?? new Date();
  const manifest = parseMarketFinderOnboardingManifest(untrustedManifest, now);
  const begin = (sql as TransactionSql).begin;
  if (typeof begin !== "function") {
    throw new Error(
      "Market Finder onboarding requires transactional database access.",
    );
  }
  const apply = options.apply === true;
  return (await begin.call(
    sql,
    apply ? "isolation level serializable" : "read only",
    async (transaction) => {
      const operatorSubject = await resolveMarketFinderOnboardingAdmin(
        transaction,
        options.operatorEmail ?? process.env.MODERATION_OPERATOR_EMAIL,
      );
      const plan = await buildOnboardingPlan(transaction, manifest);
      if (!apply) {
        return boundedResult("dry-run", plan, false);
      }
      const changed = planHasWrites(plan)
        ? await applyOnboardingPlan(
            transaction,
            operatorSubject,
            manifest,
            plan,
          )
        : false;
      return boundedResult("applied", plan, changed);
    },
  )) as MarketFinderOnboardingResult;
}

async function main() {
  const command = parseMarketFinderOnboardingCommand(process.argv.slice(2));
  const now = new Date();
  const manifest = await readMarketFinderOnboardingManifest(
    command.manifestPath,
    now,
  );
  const databaseUrl = requireAdminDatabaseUrl({
    MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
  });
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const result = await runMarketFinderOnboarding(sql, manifest, {
      apply: command.apply,
      operatorEmail: process.env.MODERATION_OPERATOR_EMAIL,
      now,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function safeErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const paths = [
      ...new Set(
        error.issues.map((issue) => issue.path.join(".") || "manifest"),
      ),
    ];
    return `Market Finder onboarding manifest validation failed at ${paths.join(", ")}.`;
  }
  if (error instanceof OnboardingConflictError) return error.message;
  return error instanceof Error
    ? error.message
    : "Market Finder onboarding failed.";
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
