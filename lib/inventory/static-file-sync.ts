import "server-only";
import type { InventoryRefreshTerminalReason } from "@/lib/inventory/refresh-policy";

/* -------------------------------------------------------------------------- */
/*                              Public types                                  */
/* -------------------------------------------------------------------------- */

export type StaticFileSyncResult = {
  synced: number;
  invalidated: number;
  skipped: number;
  committed: boolean;
  commitSha: string | null;
  errors: string[];
};

export type StaticFileSyncConfig = {
  enabled: true;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
};

export type StaticFileSyncConfigIssue =
  "missing_github_token" | "missing_review_branch" | "invalid_review_branch";

export type StaticFileSyncConfiguration =
  | { status: "disabled" }
  | { status: "misconfigured"; issue: StaticFileSyncConfigIssue }
  | { status: "ready"; config: StaticFileSyncConfig };

export type StaticFileRefreshedOffer = {
  productSlug: string;
  retailer: string;
  priceNgn: number | null;
  available: boolean;
  inventoryStatus: string;
  lastVerifiedAt: Date;
  verificationExpiresAt: Date;
  verificationMethod: string;
  extractionConfidence: number;
};

export type StaticFileInvalidatedOffer = {
  productSlug: string;
  retailer: string;
  invalidatedAt: Date;
  reason: InventoryRefreshTerminalReason;
};

type StaticVerificationMethod = "retailer_page" | "api";

/* -------------------------------------------------------------------------- */
/*                              Constants                                     */
/* -------------------------------------------------------------------------- */

const FILE_PATH = "data/retail-offers.ts";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_STATIC_SYNC_CONFIDENCE = 60;
const MAX_AUTOMATED_PRICE_CHANGE_RATIO = 0.35;
const REVIEW_BRANCH_PATTERN = /^inventory-sync-review(?:[-/][a-z0-9._-]+)?$/i;
const MAX_FRESHNESS_DAYS: Record<string, number> = {
  retailer_page: 5,
  api: 7,
};

/**
 * Verification methods that are eligible for auto-sync. Offers with
 * `verificationMethod === "manual"` are never auto-synced — they represent
 * manually-curated, verified data that must not be overwritten by cron output.
 */
const ALLOWED_VERIFICATION_METHODS = new Set<StaticVerificationMethod>([
  "retailer_page",
  "api",
]);

function isAllowedVerificationMethod(
  value: string,
): value is StaticVerificationMethod {
  return ALLOWED_VERIFICATION_METHODS.has(value as StaticVerificationMethod);
}

/* -------------------------------------------------------------------------- */
/*                              Config                                        */
/* -------------------------------------------------------------------------- */

/**
 * Distinguishes intentionally disabled sync from enabled-but-invalid
 * configuration without exposing any credential value.
 *
 * Env vars:
 * - `STATIC_FILE_SYNC_ENABLED` — must be `"true"` to enable
 * - `GITHUB_TOKEN`             — required repo-write token
 * - `GITHUB_REPO_OWNER`        — defaults to `"Dr-dyrane"`
 * - `GITHUB_REPO_NAME`         — defaults to `"jelo"`
 * - `GITHUB_REPO_BRANCH`       — required `inventory-sync-review*` branch
 */
export function staticFileSyncConfiguration(
  env: Record<string, string | undefined> = process.env,
): StaticFileSyncConfiguration {
  if (env.STATIC_FILE_SYNC_ENABLED !== "true") return { status: "disabled" };
  if (!env.GITHUB_TOKEN?.trim()) {
    return { status: "misconfigured", issue: "missing_github_token" };
  }
  const branch = env.GITHUB_REPO_BRANCH?.trim();
  if (!branch) {
    return { status: "misconfigured", issue: "missing_review_branch" };
  }
  if (!REVIEW_BRANCH_PATTERN.test(branch)) {
    return { status: "misconfigured", issue: "invalid_review_branch" };
  }

  return {
    status: "ready",
    config: {
      enabled: true,
      githubToken: env.GITHUB_TOKEN,
      owner: env.GITHUB_REPO_OWNER ?? "Dr-dyrane",
      repo: env.GITHUB_REPO_NAME ?? "jelo",
      branch,
    },
  };
}

export function staticFileSyncConfig(
  env: Record<string, string | undefined> = process.env,
): StaticFileSyncConfig | null {
  const configuration = staticFileSyncConfiguration(env);
  return configuration.status === "ready" ? configuration.config : null;
}

/* -------------------------------------------------------------------------- */
/*                       Small utility helpers                                */
/* -------------------------------------------------------------------------- */

/** Escape a string for safe use inside a `RegExp`. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert a `Date` to the compact ISO 8601 format used throughout the static
 * file (e.g. `"2026-08-09T12:27:59Z"` — no millisecond component).
 */
function toISODateString(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Add `days` to a `Date` and return a new `Date`. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Map an inventory-status string from the database to the `ObservedStock`
 * union (`'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown'`) used by the
 * static file's `exactNg` options.
 */
function mapInventoryStatusToStock(inventoryStatus: string): string {
  const normalized = inventoryStatus.toLowerCase().replace(/[\s_-]/g, "");
  switch (normalized) {
    case "instock":
    case "available":
    case "in":
      return "in-stock";
    case "outofstock":
    case "unavailable":
    case "soldout":
    case "out":
      return "out-of-stock";
    case "lowstock":
    case "limited":
    case "low":
      return "low-stock";
    default:
      return "unknown";
  }
}

/* -------------------------------------------------------------------------- */
/*                String-aware bracket/paren matching                         */
/* -------------------------------------------------------------------------- */

/**
 * Starting at `openPos` (the position of the opening bracket), find the
 * position of the matching closing bracket, skipping over string literals.
 *
 * Returns -1 if no match is found.
 */
function findMatchingCloser(
  text: string,
  openPos: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let i = openPos;
  let inString = false;
  let stringChar = "";

  while (i < text.length) {
    const char = text[i];

    if (inString) {
      if (char === "\\") {
        i += 2; // skip escaped char
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      i++;
      continue;
    }

    if (char === open) {
      depth++;
    } else if (char === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/* -------------------------------------------------------------------------- */
/*                       Static-file parsing helpers                          */
/* -------------------------------------------------------------------------- */

/**
 * Extract the top-level `checkedAt` constant from the file, used as the
 * fallback observation time for offers that don't specify `observedAt`.
 */
function parseTopLevelCheckedAt(content: string): string | null {
  const match = /const\s+checkedAt\s*=\s*"([^"]+)"/.exec(content);
  return match ? match[1] : null;
}

/**
 * Locate the array section for a given product slug inside the
 * `verifiedRetailOffers` object.
 *
 * Returns the half-open range `[start, end)` where `start` is the character
 * after the opening `[` and `end` is the position of the closing `]`.
 */
function findSlugSection(
  content: string,
  slug: string,
): { start: number; end: number } | null {
  const slugRegex = new RegExp(`"${escapeRegex(slug)}"\\s*:\\s*\\[`);
  const match = slugRegex.exec(content);
  if (!match) return null;

  const bracketPos = content.indexOf("[", match.index);
  if (bracketPos === -1) return null;

  const endPos = findMatchingCloser(content, bracketPos, "[", "]");
  if (endPos === -1) return null;

  return { start: bracketPos + 1, end: endPos };
}

/**
 * Within a slug section, find the `exactNg(…)` call whose first argument
 * (retailer name) matches `retailer`.
 *
 * Returns the half-open range `[start, end)` covering the entire call
 * including the trailing comma if present.
 */
function findExactNgCall(
  content: string,
  sectionStart: number,
  sectionEnd: number,
  retailer: string,
): { start: number; end: number } | null {
  const section = content.slice(sectionStart, sectionEnd);
  const exactNgRegex = /exactNg\(\s*"/g;
  let match: RegExpExecArray | null;

  while ((match = exactNgRegex.exec(section)) !== null) {
    // Extract the retailer name (first string argument)
    const retailerMatch = /^exactNg\(\s*"([^"]+)"/.exec(
      section.slice(match.index),
    );
    if (!retailerMatch || retailerMatch[1] !== retailer) continue;

    // Find the end of the exactNg call using parenthesis matching
    const parenPos = section.indexOf("(", match.index);
    if (parenPos === -1) continue;

    const endParen = findMatchingCloser(section, parenPos, "(", ")");
    if (endParen === -1) continue;

    // Include trailing comma if present
    let end = endParen + 1;
    if (section[end] === ",") end++;

    return {
      start: sectionStart + match.index,
      end: sectionStart + end,
    };
  }
  return null;
}

/**
 * Extract the `observedAt` value from an offer's options object.
 * Returns `null` if the field is not present.
 */
function extractObservedAt(offerText: string): string | null {
  const match = /\bobservedAt\s*:\s*"([^"]+)"/.exec(offerText);
  return match ? match[1] : null;
}

function extractExpiresAt(offerText: string): string | null {
  const match = /\bexpiresAt\s*:\s*"([^"]+)"/.exec(offerText);
  return match ? match[1] : null;
}

function extractPriceNgn(offerText: string): number | null {
  const match = /^exactNg\(\s*"[^"]+",\s*"[^"]+",\s*\d+,\s*(\d+),/.exec(
    offerText,
  );
  if (!match) return null;
  const price = Number(match[1]);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

/* -------------------------------------------------------------------------- */
/*                       Offer-block update helpers                           */
/* -------------------------------------------------------------------------- */

type OfferUpdates = {
  priceNgn?: number;
  available?: boolean;
  stock?: string;
  observedAt?: string;
  expiresAt?: string;
  verificationMethod?: "retailer_page" | "api";
};

/**
 * Add a field to the options object of an `exactNg(…)` call. If the field
 * already exists it is replaced in-place; otherwise it is inserted into the
 * options object (or a new options object is created when none exists).
 *
 * Returns the modified offer text. If the insertion cannot be performed
 * safely the original text is returned unchanged.
 */
function addFieldToOptionsObject(
  offerText: string,
  field: string,
  valueStr: string,
): string {
  // --- Case 1: field already exists — replace in-place ---------------------
  const replaceRegex = new RegExp(
    `(\\b${field}\\s*:\\s*)(?:"[^"]*"|true|false|-?\\d+)`,
  );
  if (replaceRegex.test(offerText)) {
    return offerText.replace(replaceRegex, `$1${valueStr}`);
  }

  // --- Case 2: field does not exist — need to insert it --------------------

  // Find the options object (the last { … } block in the call).
  const lastOpenBrace = offerText.lastIndexOf("{");

  if (lastOpenBrace === -1) {
    // No options object at all — add one as the 7th argument.
    const closingParen = offerText.lastIndexOf(")");
    if (closingParen === -1) return offerText;

    const before = offerText.slice(0, closingParen).trimEnd();
    const needsComma = !before.endsWith(",") && !before.endsWith("(");

    return (
      before +
      `${needsComma ? "," : ""}\n` +
      `      {\n` +
      `        ${field}: ${valueStr},\n` +
      `      }\n` +
      `    ` +
      offerText.slice(closingParen)
    );
  }

  const closingBrace = findMatchingCloser(offerText, lastOpenBrace, "{", "}");
  if (closingBrace === -1) return offerText;

  const optionsText = offerText.slice(lastOpenBrace, closingBrace + 1);
  const isMultiline = optionsText.includes("\n");

  if (isMultiline) {
    // Determine the indentation of existing fields.
    const firstFieldMatch = /\n(\s+)\w/.exec(optionsText);
    const indent = firstFieldMatch ? firstFieldMatch[1] : "        ";

    // Walk backwards from the closing `}` to find the last non-whitespace.
    let insertPos = closingBrace;
    while (
      insertPos > lastOpenBrace + 1 &&
      /\s/.test(offerText[insertPos - 1])
    ) {
      insertPos--;
    }

    const hasTrailingComma = offerText[insertPos - 1] === ",";

    if (hasTrailingComma) {
      return (
        offerText.slice(0, insertPos) +
        "\n" +
        indent +
        field +
        ": " +
        valueStr +
        "," +
        offerText.slice(insertPos)
      );
    }
    return (
      offerText.slice(0, insertPos) +
      ",\n" +
      indent +
      field +
      ": " +
      valueStr +
      "," +
      offerText.slice(insertPos)
    );
  }

  // Single-line options object: { observedAt: "…", expiresAt: "…" }
  const inner = offerText.slice(lastOpenBrace + 1, closingBrace).trim();
  if (inner === "") {
    return (
      offerText.slice(0, lastOpenBrace + 1) +
      ` ${field}: ${valueStr} ` +
      offerText.slice(closingBrace)
    );
  }

  const beforeBrace = offerText.slice(0, closingBrace).trimEnd();
  const needsComma = !beforeBrace.endsWith(",");
  return (
    beforeBrace +
    `${needsComma ? ", " : " "}${field}: ${valueStr} ` +
    offerText.slice(closingBrace)
  );
}

/**
 * Apply targeted field updates to a single `exactNg(…)` offer block.
 *
 * Only the following fields are touched:
 * - `priceNgn`     → 4th positional argument
 * - `available`    → options field
 * - `stock`        → options field (mapped from `inventoryStatus`)
 * - `observedAt`   → options field (maps to `checkedAt` in the Offer type)
 * - `expiresAt`    → options field
 * - `verificationMethod` → options field (retailer page or retailer API)
 *
 * All other fields (retailer, url, trust, variant, size, inventoryQuantity,
 * sellerName, sellerScore, priceComparison) are left untouched.
 */
function updateOfferBlock(offerText: string, updates: OfferUpdates): string {
  let result = offerText;

  // 1. priceNgn — 4th positional argument of exactNg
  if (updates.priceNgn !== undefined) {
    result = result.replace(
      /^(exactNg\(\s*"[^"]+",\s*"[^"]+",\s*\d+,\s*)(\d+)(,)/,
      `$1${updates.priceNgn}$3`,
    );
  }

  // 2. observedAt — options field
  if (updates.observedAt !== undefined) {
    result = addFieldToOptionsObject(
      result,
      "observedAt",
      `"${updates.observedAt}"`,
    );
  }

  // 3. expiresAt — options field
  if (updates.expiresAt !== undefined) {
    result = addFieldToOptionsObject(
      result,
      "expiresAt",
      `"${updates.expiresAt}"`,
    );
  }

  // 4. available — options field (boolean)
  if (updates.available !== undefined) {
    result = addFieldToOptionsObject(
      result,
      "available",
      String(updates.available),
    );
  }

  // 5. stock — options field (string)
  if (updates.stock !== undefined) {
    result = addFieldToOptionsObject(result, "stock", `"${updates.stock}"`);
  }

  if (updates.verificationMethod !== undefined) {
    result = addFieldToOptionsObject(
      result,
      "verificationMethod",
      `"${updates.verificationMethod}"`,
    );
  }

  return result;
}

/**
 * Verify that all requested updates were actually applied to the offer text.
 * Returns `false` if any field that should have been updated still holds its
 * old value (or is absent when it should have been added).
 */
function verifyOfferUpdate(offerText: string, updates: OfferUpdates): boolean {
  if (updates.observedAt !== undefined) {
    const m = /\bobservedAt\s*:\s*"([^"]+)"/.exec(offerText);
    if (!m || m[1] !== updates.observedAt) return false;
  }
  if (updates.expiresAt !== undefined) {
    const m = /\bexpiresAt\s*:\s*"([^"]+)"/.exec(offerText);
    if (!m || m[1] !== updates.expiresAt) return false;
  }
  if (updates.priceNgn !== undefined) {
    const m = /^exactNg\(\s*"[^"]+",\s*"[^"]+",\s*\d+,\s*(\d+),/.exec(
      offerText,
    );
    if (!m || m[1] !== String(updates.priceNgn)) return false;
  }
  if (updates.available !== undefined) {
    const m = /\bavailable\s*:\s*(true|false)/.exec(offerText);
    if (!m || m[1] !== String(updates.available)) return false;
  }
  if (updates.stock !== undefined) {
    const m = /\bstock\s*:\s*"([^"]+)"/.exec(offerText);
    if (!m || m[1] !== updates.stock) return false;
  }
  if (updates.verificationMethod !== undefined) {
    const m = /\bverificationMethod\s*:\s*"([^"]+)"/.exec(offerText);
    if (!m || m[1] !== updates.verificationMethod) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*                    Single-offer content update                             */
/* -------------------------------------------------------------------------- */

/**
 * Attempt to update a single offer inside the file content.
 *
 * Returns `{ updated: true, content }` on success, or
 * `{ updated: false, content, error? }` when the offer was skipped.
 */
function updateOfferInContent(
  content: string,
  offer: StaticFileRefreshedOffer,
  topLevelCheckedAt: string | null,
): { updated: boolean; content: string; error?: string } {
  // 1. Find the slug section
  const section = findSlugSection(content, offer.productSlug);
  if (!section) {
    return {
      updated: false,
      content,
      error: `Product slug not found in static file: ${offer.productSlug}`,
    };
  }

  // 2. Find the exactNg call for this retailer
  const call = findExactNgCall(
    content,
    section.start,
    section.end,
    offer.retailer,
  );
  if (!call) {
    return {
      updated: false,
      content,
      error: `Offer not found in static file: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  const offerText = content.slice(call.start, call.end);

  if (!isAllowedVerificationMethod(offer.verificationMethod)) {
    return { updated: false, content };
  }
  if (
    !Number.isFinite(offer.extractionConfidence) ||
    offer.extractionConfidence < MIN_STATIC_SYNC_CONFIDENCE
  ) {
    return {
      updated: false,
      content,
      error: `Static publication requires confidence >= ${MIN_STATIC_SYNC_CONFIDENCE}: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  // 3. Determine the static offer's current checkedAt
  const currentObservedAt = extractObservedAt(offerText);
  const staticCheckedAt = currentObservedAt ?? topLevelCheckedAt;

  if (!staticCheckedAt) {
    return {
      updated: false,
      content,
      error: `Cannot determine static checkedAt for: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  // 4. Freshness gate — only update if the refreshed data is strictly newer
  const staticDate = new Date(staticCheckedAt);
  if (!Number.isFinite(staticDate.valueOf())) {
    return {
      updated: false,
      content,
      error: `Static checkedAt is invalid: ${offer.productSlug} / ${offer.retailer}`,
    };
  }
  if (offer.lastVerifiedAt <= staticDate) {
    return { updated: false, content };
  }

  if (
    !Number.isFinite(offer.lastVerifiedAt.valueOf()) ||
    !Number.isFinite(offer.verificationExpiresAt.valueOf()) ||
    offer.verificationExpiresAt <= offer.lastVerifiedAt
  ) {
    return {
      updated: false,
      content,
      error: `Verification window is invalid: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  if (offer.priceNgn != null) {
    if (!Number.isSafeInteger(offer.priceNgn) || offer.priceNgn <= 0) {
      return {
        updated: false,
        content,
        error: `Refreshed price is invalid: ${offer.productSlug} / ${offer.retailer}`,
      };
    }
    const currentPriceNgn = extractPriceNgn(offerText);
    if (currentPriceNgn != null) {
      const changeRatio =
        Math.abs(offer.priceNgn - currentPriceNgn) / currentPriceNgn;
      if (changeRatio > MAX_AUTOMATED_PRICE_CHANGE_RATIO) {
        return {
          updated: false,
          content,
          error:
            `Price change exceeds ${MAX_AUTOMATED_PRICE_CHANGE_RATIO * 100}% review bound: ` +
            `${offer.productSlug} / ${offer.retailer}`,
        };
      }
    }
  }

  // 5. Compute new field values
  const newObservedAt = toISODateString(offer.lastVerifiedAt);
  const maximumExpiresAt = addDays(
    offer.lastVerifiedAt,
    MAX_FRESHNESS_DAYS[offer.verificationMethod],
  );
  const newExpiresAt = toISODateString(
    new Date(
      Math.min(
        offer.verificationExpiresAt.valueOf(),
        maximumExpiresAt.valueOf(),
      ),
    ),
  );
  const newStock = mapInventoryStatusToStock(offer.inventoryStatus);

  const updates: OfferUpdates = {
    priceNgn: offer.priceNgn ?? undefined,
    available: offer.available,
    stock: newStock,
    observedAt: newObservedAt,
    expiresAt: newExpiresAt,
    verificationMethod: offer.verificationMethod,
  };

  // 6. Apply updates to the offer block
  const updatedOfferText = updateOfferBlock(offerText, updates);

  if (updatedOfferText === offerText) {
    return { updated: false, content };
  }

  // 7. Verify the updates were applied correctly
  if (!verifyOfferUpdate(updatedOfferText, updates)) {
    return {
      updated: false,
      content,
      error: `Failed to safely update offer: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  // 8. Splice the updated block back into the content
  const newContent =
    content.slice(0, call.start) + updatedOfferText + content.slice(call.end);

  return { updated: true, content: newContent };
}

function invalidateOfferInContent(
  content: string,
  offer: StaticFileInvalidatedOffer,
  topLevelCheckedAt: string | null,
): { updated: boolean; content: string; error?: string } {
  const section = findSlugSection(content, offer.productSlug);
  if (!section) {
    return {
      updated: false,
      content,
      error: `Product slug not found for terminal invalidation: ${offer.productSlug}`,
    };
  }

  const call = findExactNgCall(
    content,
    section.start,
    section.end,
    offer.retailer,
  );
  if (!call) {
    return {
      updated: false,
      content,
      error: `Offer not found for terminal invalidation: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  if (!Number.isFinite(offer.invalidatedAt.valueOf())) {
    return {
      updated: false,
      content,
      error: `Terminal invalidation time is invalid: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  const offerText = content.slice(call.start, call.end);
  const staticCheckedAt = extractObservedAt(offerText) ?? topLevelCheckedAt;
  if (!staticCheckedAt) {
    return {
      updated: false,
      content,
      error: `Cannot determine static checkedAt for terminal invalidation: ${offer.productSlug} / ${offer.retailer}`,
    };
  }
  const staticDate = new Date(staticCheckedAt);
  if (!Number.isFinite(staticDate.valueOf())) {
    return {
      updated: false,
      content,
      error: `Static checkedAt is invalid for terminal invalidation: ${offer.productSlug} / ${offer.retailer}`,
    };
  }
  if (offer.invalidatedAt <= staticDate) {
    return { updated: false, content };
  }

  const currentExpiresAt = extractExpiresAt(offerText);
  const currentExpiry = currentExpiresAt ? new Date(currentExpiresAt) : null;
  if (currentExpiry && !Number.isFinite(currentExpiry.valueOf())) {
    return {
      updated: false,
      content,
      error: `Static expiry is invalid for terminal invalidation: ${offer.productSlug} / ${offer.retailer}`,
    };
  }
  const expiresAt =
    currentExpiry && currentExpiry <= offer.invalidatedAt
      ? currentExpiresAt!
      : toISODateString(offer.invalidatedAt);
  const updates: OfferUpdates = {
    available: false,
    stock: "unknown",
    expiresAt,
  };
  const updatedOfferText = updateOfferBlock(offerText, updates);
  if (
    updatedOfferText === offerText ||
    !verifyOfferUpdate(updatedOfferText, updates)
  ) {
    return {
      updated: false,
      content,
      error: `Failed to apply ${offer.reason} terminal invalidation: ${offer.productSlug} / ${offer.retailer}`,
    };
  }

  return {
    updated: true,
    content:
      content.slice(0, call.start) + updatedOfferText + content.slice(call.end),
  };
}

/* -------------------------------------------------------------------------- */
/*                       GitHub API helpers                                   */
/* -------------------------------------------------------------------------- */

type GitHubFileResponse = {
  content: string;
  sha: string;
};

type GitHubCommitResponse = {
  commit?: { sha: string };
  content?: { sha: string };
};

export function describeStaticFileSyncGetFailure(input: {
  status: number;
  statusText: string;
  rateLimitRemaining?: string | null;
}) {
  if (input.status === 403 && input.rateLimitRemaining === "0") {
    return "static_file_sync_github_rate_limited";
  }
  if (input.status === 404) {
    return "static_file_sync_review_branch_not_found: GITHUB_REPO_BRANCH must name an existing inventory-sync-review* branch";
  }
  return `static_file_sync_github_get_failed:${input.status} ${input.statusText}`;
}

/** Common headers for all GitHub API requests. */
function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

/**
 * Fetch the current content and SHA of `data/retail-offers.ts` from GitHub.
 * Returns `{ content, sha }` on success or `{ error }` on failure.
 */
async function fetchFileFromGitHub(
  config: StaticFileSyncConfig,
): Promise<{ content: string; sha: string } | { error: string }> {
  try {
    const url =
      `https://api.github.com/repos/${config.owner}/${config.repo}` +
      `/contents/${FILE_PATH}?ref=${config.branch}`;

    const res = await fetch(url, {
      headers: githubHeaders(config.githubToken),
    });

    if (!res.ok) {
      return {
        error: describeStaticFileSyncGetFailure({
          status: res.status,
          statusText: res.statusText,
          rateLimitRemaining: res.headers.get("X-RateLimit-Remaining"),
        }),
      };
    }

    const data = (await res.json()) as GitHubFileResponse;
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { content, sha: data.sha };
  } catch (err) {
    return {
      error: `Failed to fetch file from GitHub: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Commit updated file content to GitHub via the Contents API.
 * Returns the commit SHA on success or an error message on failure.
 */
async function commitFileToGitHub(
  config: StaticFileSyncConfig,
  content: string,
  sha: string,
  syncedCount: number,
): Promise<{ commitSha: string } | { error: string }> {
  try {
    const url =
      `https://api.github.com/repos/${config.owner}/${config.repo}` +
      `/contents/${FILE_PATH}`;

    const body = {
      message: `sync: update ${syncedCount} offers from inventory cron refresh`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
      branch: config.branch,
    };

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...githubHeaders(config.githubToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 403) {
        const remaining = res.headers.get("X-RateLimit-Remaining");
        if (remaining === "0") {
          return { error: "GitHub API rate limit exceeded" };
        }
      }
      const text = await res.text().catch(() => res.statusText);
      return {
        error: `GitHub API PUT failed: ${res.status} ${text}`,
      };
    }

    const data = (await res.json()) as GitHubCommitResponse;
    const commitSha = data.commit?.sha ?? data.content?.sha ?? null;

    if (!commitSha) {
      return { error: "GitHub commit succeeded but no SHA was returned" };
    }

    return { commitSha };
  } catch (err) {
    return {
      error: `Failed to commit to GitHub: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                       Main export                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sync refreshed offer data back to the static `data/retail-offers.ts` file
 * via the GitHub Contents API.
 *
 * Safety guarantees:
 * 1. Never touches offers with `verificationMethod === "manual"`.
 * 2. Only processes confidence-60+ retailer-page or retailer-API evidence.
 *    AI extraction remains database-only and can never enter static share data.
 * 3. Only updates `priceNgn`, `available`, `inventoryStatus` (→ `stock`),
 *    `checkedAt` (→ `observedAt`), `expiresAt`, and verification provenance.
 * 4. Never modifies `url`, `trust`, `match`, `variant`, `size`, or any other
 *    manually-set field.
 * 5. Uses a diff-based approach — reads the current file, applies only the
 *    changed offers, and writes back. Never blindly overwrites the whole file.
 * 6. Only runs when `STATIC_FILE_SYNC_ENABLED=true`, `GITHUB_TOKEN` is set,
 *    and `GITHUB_REPO_BRANCH` names an `inventory-sync-review*` branch.
 * 7. Typed terminal contradictions can only mark the exact fallback unavailable
 *    and expired; they preserve price, URL, title, size, and observation provenance.
 * 8. Safe to call with empty arrays or when the GitHub API is down —
 *    returns errors, never throws.
 */
export function applyStaticOfferRefreshes(input: {
  content: string;
  refreshedOffers: StaticFileRefreshedOffer[];
  invalidatedOffers?: StaticFileInvalidatedOffer[];
}) {
  const result = {
    content: input.content,
    synced: 0,
    invalidated: 0,
    skipped: 0,
    errors: [] as string[],
  };
  const topLevelCheckedAt = parseTopLevelCheckedAt(input.content);

  for (const offer of input.refreshedOffers) {
    if (!isAllowedVerificationMethod(offer.verificationMethod)) {
      result.skipped++;
      continue;
    }
    const updateResult = updateOfferInContent(
      result.content,
      offer,
      topLevelCheckedAt,
    );
    if (updateResult.updated) {
      result.content = updateResult.content;
      result.synced++;
    } else {
      result.skipped++;
      if (updateResult.error) result.errors.push(updateResult.error);
    }
  }

  for (const offer of input.invalidatedOffers ?? []) {
    const invalidationResult = invalidateOfferInContent(
      result.content,
      offer,
      topLevelCheckedAt,
    );
    if (invalidationResult.updated) {
      result.content = invalidationResult.content;
      result.invalidated++;
    } else {
      result.skipped++;
      if (invalidationResult.error) {
        result.errors.push(invalidationResult.error);
      }
    }
  }

  return result;
}

export async function syncOffersToStaticFile(input: {
  refreshedOffers: StaticFileRefreshedOffer[];
  invalidatedOffers?: StaticFileInvalidatedOffer[];
  config?: StaticFileSyncConfig;
}): Promise<StaticFileSyncResult> {
  const emptyResult: StaticFileSyncResult = {
    synced: 0,
    invalidated: 0,
    skipped: 0,
    committed: false,
    commitSha: null,
    errors: [],
  };

  // Short-circuit on empty input
  const invalidatedOffers = input.invalidatedOffers ?? [];
  if (input.refreshedOffers.length === 0 && invalidatedOffers.length === 0) {
    return emptyResult;
  }

  // Check config — return empty result if disabled
  const config = input.config ?? staticFileSyncConfig();
  if (!config) return emptyResult;

  if (
    invalidatedOffers.length === 0 &&
    !input.refreshedOffers.some(
      (offer) =>
        isAllowedVerificationMethod(offer.verificationMethod) &&
        offer.extractionConfidence >= MIN_STATIC_SYNC_CONFIDENCE,
    )
  ) {
    return { ...emptyResult, skipped: input.refreshedOffers.length };
  }

  // --- Fetch current file from GitHub --------------------------------------
  const fetched = await fetchFileFromGitHub(config);
  if ("error" in fetched) {
    return { ...emptyResult, errors: [fetched.error] };
  }

  const { content: fileContent, sha: fileSha } = fetched;

  const projection = applyStaticOfferRefreshes({
    content: fileContent,
    refreshedOffers: input.refreshedOffers,
    invalidatedOffers,
  });
  const result: StaticFileSyncResult = {
    synced: projection.synced,
    invalidated: projection.invalidated,
    skipped: projection.skipped,
    committed: false,
    commitSha: null,
    errors: projection.errors,
  };

  // --- Commit if anything changed ------------------------------------------
  if (result.synced === 0 && result.invalidated === 0) return result;

  const committed = await commitFileToGitHub(
    config,
    projection.content,
    fileSha,
    result.synced + result.invalidated,
  );

  if ("error" in committed) {
    result.errors.push(committed.error);
    return result;
  }

  result.committed = true;
  result.commitSha = committed.commitSha;

  return result;
}
