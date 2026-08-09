import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  catalogueIdentityExtractionCanonicalJson,
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  catalogueManufacturerSkuBarcodeAliasIdentityExtractionSchemaVersion,
  type CatalogueIntakeCandidate,
  type CatalogueManufacturerSkuIdentityExtraction,
  type CatalogueManufacturerSkuBarcodeAliasIdentityExtraction,
} from "./intake-readiness";
import {
  catalogueExactOfferManufacturerSkuEvidenceSchemaVersion,
  catalogueExactOfferRetainedGtinEvidenceSchemaVersion,
  type ReviewedManufacturerSkuExactOfferEvidence,
  type ReviewedRetainedGtinExactOfferEvidence,
} from "./market-evidence";
import {
  sourceTextNamesCatalogueBrandField,
  verifiedCatalogueRetainedRecord,
} from "./retained-record";

const sha256Pattern = /^[0-9a-f]{64}$/;

const structuredIdentifierKey =
  "(?:barcode(?:[_-]?(?:value|number))?" +
  "|gtin(?:[_-]?(?:8|12|13|14|value|number))?" +
  "|ean(?:[_-]?(?:8|13|value|number))?" +
  "|upc(?:[_-]?(?:a|e|value|number))?)";

const exactStructuredIdentifierKey = new RegExp(
  `^${structuredIdentifierKey}$`,
  "i",
);

type StructuredIdentifierMatch = {
  term: string;
  index: number;
};

function retainedScriptBodies(source: string) {
  return Array.from(
    source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi),
  ).map((match) => {
    const start = (match.index ?? 0) + match[0].indexOf(">") + 1;
    return {
      source: match[1],
      start,
      end: start + match[1].length,
    };
  });
}

function decodeHtmlJsonSyntaxEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded
      .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
      .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
      .replace(/&colon;|&#0*58;|&#x0*3a;/gi, ":")
      .replace(/&amp;/gi, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

/**
 * Rendered DOM snapshots entity-encode quotes inside JSON-valued attributes. Decode and parse
 * only complete JSON attribute values: a quoted identifier term in visible prose is not evidence
 * that the page publishes a structured identifier.
 */
function structuredIdentifierKeysInHtmlJsonAttributes(source: string) {
  const matches: StructuredIdentifierMatch[] = [];
  const tagPattern = /<[A-Za-z][^<>]*>/g;
  const excludedRanges = [
    ...retainedScriptBodies(source).map((script) => ({
      start: script.start,
      end: script.end,
    })),
    ...Array.from(source.matchAll(/<!--[\s\S]*?-->/g)).map((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })),
  ];

  for (const tagMatch of source.matchAll(tagPattern)) {
    if (
      excludedRanges.some(
        (range) =>
          (tagMatch.index ?? 0) >= range.start &&
          (tagMatch.index ?? 0) < range.end,
      )
    )
      continue;
    const tag = tagMatch[0];
    const attributePattern = /\s[^\s"'<>/=]+\s*=\s*(["'])([\s\S]*?)\1/g;
    for (const attributeMatch of tag.matchAll(attributePattern)) {
      const encodedValue = attributeMatch[2];
      if (!encodedValue.includes("&")) continue;
      const decodedValue = decodeHtmlJsonSyntaxEntities(encodedValue).trim();
      if (!decodedValue.startsWith("{") && !decodedValue.startsWith("["))
        continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(decodedValue) as unknown;
      } catch {
        // Retained storefront attributes occasionally serialize a JavaScript object literal with
        // entity-encoded single quotes. Keep that fallback object-shaped and key-delimited.
        const objectKeyPattern = new RegExp(
          `(?:^|[{,])\\s*["'](${structuredIdentifierKey})["']\\s*:`,
          "gi",
        );
        for (const keyMatch of decodedValue.matchAll(objectKeyPattern)) {
          const key = keyMatch[1];
          const keyOffset = encodedValue
            .toLowerCase()
            .indexOf(key.toLowerCase());
          matches.push({
            term: key,
            index:
              (tagMatch.index ?? 0) +
              (attributeMatch.index ?? 0) +
              attributeMatch[0].indexOf(encodedValue) +
              Math.max(0, keyOffset),
          });
        }
        continue;
      }

      const visit = (value: unknown) => {
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (!value || typeof value !== "object") return;
        for (const [key, child] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (exactStructuredIdentifierKey.test(key)) {
            const keyOffset = encodedValue
              .toLowerCase()
              .indexOf(key.toLowerCase());
            matches.push({
              term: key,
              index:
                (tagMatch.index ?? 0) +
                (attributeMatch.index ?? 0) +
                attributeMatch[0].indexOf(encodedValue) +
                Math.max(0, keyOffset),
            });
          }
          visit(child);
        }
      };
      visit(parsed);
    }
  }
  return matches;
}

/**
 * Marks executable JavaScript characters while leaving strings, comments, template bodies and
 * regular-expression literals unmarked. The result lets the narrow assignment patterns below
 * reject quoted examples without executing retained page code.
 */
function retainedJavaScriptCodeMask(source: string) {
  const code = new Uint8Array(source.length);
  const regexPrefixKeywords = new Set([
    "await",
    "case",
    "delete",
    "do",
    "else",
    "in",
    "instanceof",
    "new",
    "of",
    "return",
    "throw",
    "typeof",
    "void",
    "yield",
  ]);
  let index = 0;
  let regexCanStart = true;

  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      code[index] = 1;
      index += 1;
      continue;
    }

    if (character === "/" && source[index + 1] === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      )
        index += 1;
      index = Math.min(source.length, index + 2);
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      regexCanStart = false;
      continue;
    }

    if (character === "/" && regexCanStart) {
      index += 1;
      let inCharacterClass = false;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === "[") {
          inCharacterClass = true;
        } else if (source[index] === "]") {
          inCharacterClass = false;
        } else if (source[index] === "/" && !inCharacterClass) {
          index += 1;
          while (/[A-Za-z]/.test(source[index] ?? "")) index += 1;
          break;
        } else if (source[index] === "\n") {
          break;
        }
        index += 1;
      }
      regexCanStart = false;
      continue;
    }

    if (/[A-Za-z_$]/.test(character)) {
      const start = index;
      index += 1;
      while (/[A-Za-z0-9_$]/.test(source[index] ?? "")) index += 1;
      code.fill(1, start, index);
      regexCanStart = regexPrefixKeywords.has(source.slice(start, index));
      continue;
    }

    if (/\d/.test(character)) {
      const start = index;
      index += 1;
      while (/[A-Za-z0-9_.]/.test(source[index] ?? "")) index += 1;
      code.fill(1, start, index);
      regexCanStart = false;
      continue;
    }

    code[index] = 1;
    regexCanStart = !/[)\]}]/.test(character);
    index += 1;
  }

  return code;
}

function structuredIdentifierPropertyAssignments(source: string) {
  const scripts = retainedScriptBodies(source);
  const retainedScripts =
    scripts.length > 0
      ? scripts
      : /<[A-Za-z][\s\S]*>/.test(source)
        ? []
        : [{ source, start: 0, end: source.length }];
  const matches: StructuredIdentifierMatch[] = [];
  const assignmentPatterns = [
    {
      pattern: new RegExp(
        `(?:^|[^\\w$])((?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)+)` +
          `(${structuredIdentifierKey})\\s*=(?!=|>)`,
        "gi",
      ),
      keyGroup: 2,
    },
    {
      pattern: new RegExp(
        `(?:^|[^\\w$])([A-Za-z_$][\\w$]*` +
          `(?:\\s*\\.\\s*[A-Za-z_$][\\w$]*)*)\\s*` +
          `\\[\\s*(["'])(${structuredIdentifierKey})\\2\\s*\\]\\s*=(?!=|>)`,
        "gi",
      ),
      keyGroup: 3,
    },
  ];

  for (const retainedScript of retainedScripts) {
    const code = retainedJavaScriptCodeMask(retainedScript.source);
    for (const { pattern, keyGroup } of assignmentPatterns) {
      for (const match of retainedScript.source.matchAll(pattern)) {
        const objectOffset = (match.index ?? 0) + match[0].indexOf(match[1]);
        if (code[objectOffset] !== 1) continue;
        const term = match[keyGroup];
        matches.push({
          term,
          index:
            retainedScript.start +
            (match.index ?? 0) +
            match[0].lastIndexOf(term),
        });
      }
    }
  }
  return matches;
}

/**
 * Detects machine-readable identifier keys, including common suffix/casing variants, without
 * treating ordinary editorial prose about barcodes or UPC standards as a published identifier.
 */
function structuredIdentifierKeyMatches(source: string) {
  const patterns = [
    // JSON, JSON-LD and inline JavaScript object keys.
    new RegExp(
      `(?:^|[{,;\\s])["']?(${structuredIdentifierKey})["']?\\s*:`,
      "gi",
    ),
    // HTML attributes such as itemprop="gtin13", name="ean13" or data-barcode-value="...".
    new RegExp(
      `\\b(?:itemprop|name|property|aria-label)\\s*=\\s*["'](${structuredIdentifierKey})["']`,
      "gi",
    ),
    new RegExp(`\\bdata-(${structuredIdentifierKey})\\s*=`, "gi"),
    // Visible metadata labels, e.g. <dt>GTIN13</dt> or <span>Barcode value:</span>.
    new RegExp(`>\\s*(${structuredIdentifierKey})\\s*(?::\\s*)?<`, "gi"),
    new RegExp(`(?:^|[\\n;])\\s*(${structuredIdentifierKey})\\s*:`, "gi"),
  ];
  const matches = [
    ...patterns.flatMap((pattern) =>
      Array.from(source.matchAll(pattern)).map((match) => ({
        term: match[1],
        index: (match.index ?? 0) + match[0].indexOf(match[1]),
      })),
    ),
    ...structuredIdentifierKeysInHtmlJsonAttributes(source),
    ...structuredIdentifierPropertyAssignments(source),
  ];
  return Array.from(
    new Map(
      matches.map(
        (match) =>
          [`${match.term.toLowerCase()}:${match.index}`, match] as const,
      ),
    ).values(),
  );
}

function normalizedRetainedText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function retainedTextSegments(source: string) {
  return source
    .split(/<[^>]*>/g)
    .map(normalizedRetainedText)
    .filter(Boolean);
}

function retainedExtractionFieldPresent(
  source: string,
  field: { value: unknown; sourceText: string },
) {
  if (typeof field.value !== "string") return false;
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  const normalizedValue = normalizedRetainedText(field.value);
  return (
    normalizedSourceText.length >= 3 &&
    normalizedValue.length > 0 &&
    normalizedSourceText.includes(normalizedValue) &&
    retainedTextSegments(source).some((segment) =>
      segment.includes(normalizedSourceText),
    )
  );
}

function parsedRetainedJsonObjects(source: string) {
  const parsedObjects: Array<Record<string, unknown>> = [];
  const objectStarts: number[] = [];
  let quote: '"' | "'" | "`" | undefined;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (objectStarts.length === 0) {
      if (character === "{") objectStarts.push(index);
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      objectStarts.push(index);
      continue;
    }
    if (character !== "}") continue;

    const objectStart = objectStarts.pop();
    if (objectStart === undefined) continue;
    const objectSource = source.slice(objectStart, index + 1);

    try {
      const parsed = JSON.parse(objectSource) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        parsedObjects.push(parsed as Record<string, unknown>);
    } catch {
      // Retained JavaScript may contain non-JSON objects. Only structurally parsed JSON records
      // can prove direct field relationships without executing retained page code.
    }
  }

  return parsedObjects;
}

function retainedObjectHasSkuAndBarcodeBinding(
  source: string,
  manufacturerSku: string,
  barcodeAlias: boolean,
) {
  const normalizedSku = manufacturerSku.normalize("NFKC").trim().toUpperCase();
  return parsedRetainedJsonObjects(source).some((parsed) => {
    if (!Object.hasOwn(parsed, "sku") || !Object.hasOwn(parsed, "barcode"))
      return false;
    if (typeof parsed.sku !== "string") return false;
    if (parsed.sku.normalize("NFKC").trim().toUpperCase() !== normalizedSku)
      return false;
    if (barcodeAlias) {
      // Schema 9: barcode must equal the SKU exactly and must NOT be GTIN-shaped.
      if (typeof parsed.barcode !== "string") return false;
      if (
        parsed.barcode.normalize("NFKC").trim().toUpperCase() !== normalizedSku
      )
        return false;
      return !isGtinShapedBarcode(parsed.barcode);
    }
    return parsed.barcode === null;
  });
}

function parsedRetainedJsonProduct(source: string) {
  try {
    const parsed = JSON.parse(source) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function retainedPrimitiveStrings(value: unknown, strings: string[] = []) {
  if (typeof value === "string") {
    strings.push(value);
    return strings;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => retainedPrimitiveStrings(item, strings));
    return strings;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      retainedPrimitiveStrings(item, strings),
    );
  }
  return strings;
}

function retainedMeasurementTokens(value: string) {
  return Array.from(
    value
      .toLowerCase()
      .matchAll(
        /\b(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|ml|cl|l|mg|kg|g|oz|count|pcs?|pieces?|pack)\b/g,
      ),
  ).map((match) => {
    const amount = Number(match[1].replace(",", "."));
    const amountToken = Number.isFinite(amount)
      ? String(amount).replace(".", "d")
      : match[1];
    const unitToken = match[2]
      .replace(/[^a-z]/g, "")
      .replace(/^pieces?$/, "pc")
      .replace(/^pcs?$/, "pc");
    return `${amountToken}${unitToken}`;
  });
}

function sameRetainedUrl(left: string, right: string) {
  try {
    const leftUrl = new URL(left.startsWith("//") ? `https:${left}` : left);
    const rightUrl = new URL(right.startsWith("//") ? `https:${right}` : right);
    if (leftUrl.protocol !== "https:" || rightUrl.protocol !== "https:")
      return false;
    return leftUrl.href === rightUrl.href;
  } catch {
    return false;
  }
}

/**
 * A GTIN-shaped value is 8, 12, 13, or 14 digits (possibly with leading zeros).
 * Alphanumeric SKUs like "DGL-SKC-017" are never GTIN-shaped.
 */
function isGtinShapedBarcode(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value.trim());
}

/**
 * Shopify's product response keeps all variants inside one root object. A whole-root byte range
 * therefore proves only co-location, not that a reviewed size or package belongs to the selected
 * SKU. Single-variant products are unambiguous. Multi-variant products must carry the reviewed
 * variant, measured size and package media inside the exact variant object that owns the SKU and
 * null barcode.
 *
 * Schema 9 (barcodeAlias) accepts a non-null barcode that exactly equals the selected variant's
 * SKU and is not GTIN-shaped. This handles brands like DANG! Lifestyle that publish the same
 * alphanumeric manufacturer code in both `sku` and `barcode` fields.
 */
function retainedOfficialJsonVariantBindingValid(
  source: string,
  extraction:
    | CatalogueManufacturerSkuIdentityExtraction
    | CatalogueManufacturerSkuBarcodeAliasIdentityExtraction,
) {
  const product = parsedRetainedJsonProduct(source);
  if (
    !product ||
    !Array.isArray(product.variants) ||
    product.variants.length < 1
  )
    return false;
  const expectedSku = extraction.fields.manufacturerSku.value
    .normalize("NFKC")
    .trim()
    .toUpperCase();
  const barcodeAlias =
    "barcodeAlias" in extraction && extraction.barcodeAlias === true;
  const selectedVariants = product.variants.filter((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return false;
    const variant = value as Record<string, unknown>;
    return (
      typeof variant.sku === "string" &&
      variant.sku.normalize("NFKC").trim().toUpperCase() === expectedSku
    );
  }) as Array<Record<string, unknown>>;
  if (selectedVariants.length !== 1) return false;
  const selected = selectedVariants[0];
  if (!Object.hasOwn(selected, "barcode")) return false;

  if (barcodeAlias) {
    // Schema 9: barcode must equal the SKU exactly and must NOT be GTIN-shaped.
    if (typeof selected.barcode !== "string") return false;
    const normalizedBarcode = selected.barcode
      .normalize("NFKC")
      .trim()
      .toUpperCase();
    if (normalizedBarcode !== expectedSku) return false;
    if (isGtinShapedBarcode(selected.barcode)) return false;
  } else {
    // Schema 8: barcode must be null.
    if (selected.barcode !== null) return false;
  }

  // Reject any sibling variant with a GTIN-shaped barcode.
  for (const variant of product.variants as Array<Record<string, unknown>>) {
    if (variant === selected) continue;
    if (
      typeof variant.barcode === "string" &&
      isGtinShapedBarcode(variant.barcode)
    )
      return false;
  }

  // With one variant, product-level title, size suffix and media cannot be borrowed from a sibling.
  // This preserves the reviewed DANG response, whose one exact variant owns the SKU/barcode while
  // the same product root owns the title and reviewed package media.
  if (product.variants.length === 1) return true;

  const selectedVariant = selectedVariants[0];
  const selectedVariantSource = JSON.stringify(selectedVariant);
  const selectedStrings = retainedPrimitiveStrings(selectedVariant);
  const selectedNormalized = selectedStrings.map(normalizedRetainedText);
  const expectedSizeTokens = retainedMeasurementTokens(
    extraction.fields.size.value,
  );
  const variantPresent =
    retainedExtractionFieldPresent(
      selectedVariantSource,
      extraction.fields.variant,
    ) &&
    selectedNormalized.includes(
      normalizedRetainedText(extraction.fields.variant.value),
    );
  const sizePresent =
    retainedExtractionFieldPresent(
      selectedVariantSource,
      extraction.fields.size,
    ) &&
    expectedSizeTokens.length > 0 &&
    selectedStrings.some((value) => {
      const observed = new Set(retainedMeasurementTokens(value));
      return expectedSizeTokens.every((token) => observed.has(token));
    });
  const packageField = extraction.fields.packageVersion;
  const packagePresent = packageField.reviewedMedia
    ? selectedStrings.some((value) =>
        sameRetainedUrl(value, packageField.reviewedMedia!.sourceUrl),
      )
    : retainedExtractionFieldPresent(selectedVariantSource, packageField) &&
      selectedNormalized.includes(normalizedRetainedText(packageField.value));
  const nullBarcodeSourcePresent = retainedTextSegments(
    selectedVariantSource,
  ).some((segment) =>
    segment.includes(
      normalizedRetainedText(
        extraction.fields.gtinPublicationStatus.sourceText,
      ),
    ),
  );
  return (
    retainedExtractionFieldPresent(
      selectedVariantSource,
      extraction.fields.manufacturerSku,
    ) &&
    variantPresent &&
    sizePresent &&
    packagePresent &&
    nullBarcodeSourcePresent
  );
}

const catalogueBrandFieldLabels = new Set([
  "brand",
  "brand name",
  "vendor",
  "manufacturer",
  "manufacturer name",
]);

function retainedExplicitCatalogueBrandFieldPresent(
  source: string,
  field: { value: string; sourceText: string },
) {
  if (!sourceTextNamesCatalogueBrandField(field.sourceText, field.value))
    return false;
  const normalizedValue = normalizedRetainedText(field.value);
  const normalizedSourceText = normalizedRetainedText(field.sourceText);

  const jsonFieldPresent = parsedRetainedJsonObjects(source).some((record) =>
    Object.entries(record).some(([key, rawValue]) => {
      if (!catalogueBrandFieldLabels.has(normalizedRetainedText(key)))
        return false;
      if (typeof rawValue === "string") {
        return normalizedRetainedText(rawValue) === normalizedValue;
      }
      if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue))
        return false;
      const name = (rawValue as Record<string, unknown>).name;
      return (
        typeof name === "string" &&
        normalizedRetainedText(name) === normalizedValue
      );
    }),
  );
  if (jsonFieldPresent) return true;

  const segments = retainedTextSegments(source);
  if (segments.includes(normalizedSourceText)) return true;
  return segments.some(
    (segment, index) =>
      catalogueBrandFieldLabels.has(segment) &&
      segments[index + 1] === normalizedValue,
  );
}

function verifyRetainedManufacturerSource(
  candidate: CatalogueIntakeCandidate,
  extraction:
    | CatalogueManufacturerSkuIdentityExtraction
    | CatalogueManufacturerSkuBarcodeAliasIdentityExtraction,
  bytes: Buffer,
) {
  const candidateId = candidate.id;
  if (
    !sha256Pattern.test(extraction.sourceResponseSha256) ||
    bytes.byteLength !== extraction.sourceResponseByteSize ||
    createHash("sha256").update(bytes).digest("hex") !==
      extraction.sourceResponseSha256
  ) {
    throw new Error(
      `${candidateId} retained official identity source bytes changed.`,
    );
  }

  const source = bytes.toString("utf8");
  const retainedRecord = verifiedCatalogueRetainedRecord(
    bytes,
    extraction.productRecord,
  );
  if (!retainedRecord) {
    throw new Error(
      `${candidateId} retained official product record changed or is out of bounds.`,
    );
  }
  const productRecordSource = retainedRecord.toString("utf8");
  const fields = extraction.fields;
  const fieldChecks = {
    manufacturerBrand: retainedExplicitCatalogueBrandFieldPresent(
      productRecordSource,
      fields.manufacturerBrand,
    ),
    manufacturerBrandAliases: (fields.manufacturerBrandAliases ?? []).every(
      (alias) =>
        retainedExplicitCatalogueBrandFieldPresent(productRecordSource, alias),
    ),
    manufacturerSku:
      retainedExtractionFieldPresent(
        productRecordSource,
        fields.manufacturerSku,
      ) &&
      normalizedRetainedText(fields.manufacturerSku.sourceText).includes(
        normalizedRetainedText(fields.manufacturerSku.label),
      ),
    variant: retainedExtractionFieldPresent(
      productRecordSource,
      fields.variant,
    ),
    size: retainedExtractionFieldPresent(productRecordSource, fields.size),
    packageVersion: fields.packageVersion.reviewedMedia
      ? retainedTextSegments(productRecordSource).some((segment) =>
          segment.includes(
            normalizedRetainedText(fields.packageVersion.sourceText),
          ),
        ) &&
        fields.packageVersion.sourceText ===
          fields.packageVersion.reviewedMedia.sourceUrl &&
        candidate.asset.sourceUrl ===
          fields.packageVersion.reviewedMedia.sourceAssetUrl &&
        candidate.asset.sourceAssetSha256 ===
          fields.packageVersion.reviewedMedia.sourceAssetSha256
      : retainedExtractionFieldPresent(
          productRecordSource,
          fields.packageVersion,
        ),
  };
  const missingFields = Object.entries(fieldChecks)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  if (missingFields.length > 0) {
    throw new Error(
      `${candidateId} retained official identity source does not contain every claimed product field: ` +
        `${missingFields.join(", ")}.`,
    );
  }

  const absenceProof = extraction.fields.gtinPublicationStatus.absenceProof;
  if (absenceProof) {
    const actualMatches = structuredIdentifierKeyMatches(source);
    if (actualMatches.length !== absenceProof.matchCount) {
      throw new Error(
        `${candidateId} retained official identity source contradicts its no-GTIN search result.`,
      );
    }
    // Absence-search evidence is a rendered-DOM route. Do not let a malformed exact JSON route
    // use it to bypass the Shopify variant binding below.
    if (extraction.sourceResponseMimeType === "text/html") return;
  }

  const manufacturerSku = extraction.fields.manufacturerSku.value;
  const barcodeAlias =
    "barcodeAlias" in extraction && extraction.barcodeAlias === true;
  const nullBarcodePattern = /["']?barcode["']?\s*:\s*null/gi;
  if (
    extraction.sourceResponseMimeType !== "text/html" &&
    !retainedOfficialJsonVariantBindingValid(productRecordSource, extraction)
  ) {
    throw new Error(
      `${candidateId} retained official product record does not bind the selected SKU, variant, ` +
        `size, package and ${barcodeAlias ? "SKU-alias barcode" : "null barcode"} to one variant.`,
    );
  }
  if (
    extraction.sourceResponseMimeType === "text/html" &&
    !retainedObjectHasSkuAndBarcodeBinding(
      productRecordSource,
      manufacturerSku,
      barcodeAlias,
    )
  ) {
    throw new Error(
      `${candidateId} retained official identity source lost its ${
        barcodeAlias ? "SKU-alias barcode" : "null-barcode"
      } variant.`,
    );
  }

  // The one explicit null barcode key (schema 8) or the SKU-alias barcode (schema 9) is allowed.
  // Any other barcode/GTIN/EAN/UPC identifier term anywhere in the complete retained representation
  // makes the no-GTIN claim ambiguous.
  let withoutReviewedBarcode = source.replace(nullBarcodePattern, "");
  if (barcodeAlias) {
    // Also strip the barcode field that matches the manufacturer SKU so it's not flagged
    // as an extra identifier. The SKU value is alphanumeric and won't match GTIN patterns,
    // but we strip it to be explicit.
    const skuBarcodePattern = new RegExp(
      `["']?barcode["']?\\s*:\\s*["']${manufacturerSku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "gi",
    );
    withoutReviewedBarcode = withoutReviewedBarcode.replace(
      skuBarcodePattern,
      "",
    );
  }
  if (structuredIdentifierKeyMatches(withoutReviewedBarcode).length > 0) {
    throw new Error(
      `${candidateId} retained official identity source publishes another identifier.`,
    );
  }
}

type ReviewedManufacturerSkuOfferEvidence =
  ReviewedManufacturerSkuExactOfferEvidence;
type ReviewedRetainedGtinOfferEvidence = ReviewedRetainedGtinExactOfferEvidence;

function retailerSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function retainedOfferFieldPresent(
  source: string,
  field: { value: unknown; sourceText: string },
) {
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  const valuePresent =
    typeof field.value === "number"
      ? field.sourceText.replace(/\D/g, "").includes(String(field.value))
      : normalizedSourceText.includes(
          normalizedRetainedText(String(field.value)),
        );
  return (
    normalizedSourceText.length >= 3 &&
    valuePresent &&
    retainedTextSegments(source).some((segment) =>
      segment.includes(normalizedSourceText),
    )
  );
}

function retainedOfferSizeFieldPresent(
  source: string,
  field: { value: string; sourceText: string },
) {
  const expected = retainedMeasurementTokens(field.value);
  const sourceTextTokens = retainedMeasurementTokens(field.sourceText);
  if (
    expected.length === 0 ||
    !expected.every((token) => sourceTextTokens.includes(token))
  )
    return false;
  const sourceTokens = retainedMeasurementTokens(source);
  return expected.every((token) => sourceTokens.includes(token));
}

function retainedWooPriceFieldPresent(
  source: string,
  field: ReviewedRetainedGtinOfferEvidence["fields"]["price"],
) {
  try {
    const value = JSON.parse(field.sourceText) as {
      price?: unknown;
      currency_code?: unknown;
      currency_minor_unit?: unknown;
    };
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.price !== "string" ||
      !/^\d+$/.test(value.price) ||
      value.currency_code !== "NGN" ||
      !Number.isSafeInteger(value.currency_minor_unit) ||
      (value.currency_minor_unit as number) < 0 ||
      (value.currency_minor_unit as number) > 2 ||
      Number(value.price) / 10 ** (value.currency_minor_unit as number) !==
        field.value
    )
      return false;
    const normalizedSourceText = normalizedRetainedText(field.sourceText);
    return retainedTextSegments(source).some((segment) =>
      segment.includes(normalizedSourceText),
    );
  } catch {
    return false;
  }
}

function retainedOfferIdentityFieldPresent(
  source: string,
  field: { value: string; sourceText: string },
  mimeType: ReviewedManufacturerSkuOfferEvidence["responseMimeType"],
) {
  const normalizedValue = normalizedRetainedText(field.value);
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  if (
    normalizedValue.length === 0 ||
    normalizedSourceText.length < 3 ||
    !normalizedSourceText.includes(normalizedValue)
  )
    return false;

  if (mimeType === "application/json") {
    try {
      const primitiveStrings: string[] = [];
      const visit = (value: unknown) => {
        if (typeof value === "string") {
          primitiveStrings.push(normalizedRetainedText(value));
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (value && typeof value === "object") {
          Object.values(value as Record<string, unknown>).forEach(visit);
        }
      };
      visit(JSON.parse(source));
      return primitiveStrings.includes(normalizedValue);
    } catch {
      return false;
    }
  }

  // Brand and title must be the complete retained element text. A substring such as
  // "Brand: CeraVe" inside "Brand: CeraVe Cetaphil" is an ambiguous dual-brand claim.
  return retainedTextSegments(source).includes(normalizedSourceText);
}

function manufacturerOfferTitleMatches(
  title: string,
  candidate: CatalogueIntakeCandidate,
  officialBrandAliases: readonly string[],
) {
  const normalizedTitle = normalizedRetainedText(title);
  const normalizedVariant = normalizedRetainedText(candidate.variant);
  return [candidate.brand, ...officialBrandAliases]
    .map(normalizedRetainedText)
    .some(
      (brand) =>
        normalizedTitle === normalizedVariant ||
        normalizedTitle === `${brand} ${normalizedVariant}` ||
        (normalizedVariant.startsWith(`${brand} `) &&
          normalizedTitle === normalizedVariant),
    );
}

function verifyRetainedManufacturerOfferSource(
  candidate: CatalogueIntakeCandidate,
  retailer: string,
  evidence: ReviewedManufacturerSkuOfferEvidence,
  bytes: Buffer,
  officialBrandAliases: readonly string[],
) {
  if (
    !sha256Pattern.test(evidence.responseSha256) ||
    bytes.byteLength !== evidence.responseByteSize ||
    createHash("sha256").update(bytes).digest("hex") !== evidence.responseSha256
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer response bytes changed.`,
    );
  }

  const retainedRecord = verifiedCatalogueRetainedRecord(
    bytes,
    evidence.offerRecord,
  );
  if (!retainedRecord) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer record changed or is out of bounds.`,
    );
  }
  const source = retainedRecord.toString("utf8");
  const fields = evidence.fields;
  if (
    !retainedExplicitCatalogueBrandFieldPresent(source, fields.brand) ||
    !retainedOfferIdentityFieldPresent(
      source,
      fields.title,
      evidence.responseMimeType,
    ) ||
    !retainedOfferSizeFieldPresent(source, fields.size) ||
    (fields.packageVersion != null &&
      !retainedOfferFieldPresent(source, fields.packageVersion)) ||
    !retainedOfferFieldPresent(source, fields.price) ||
    !retainedOfferFieldPresent(source, fields.stock)
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer response does not contain every claimed field.`,
    );
  }

  const allowedBrands = [candidate.brand, ...officialBrandAliases].map(
    normalizedRetainedText,
  );
  if (
    !allowedBrands.includes(normalizedRetainedText(fields.brand.value)) ||
    !manufacturerOfferTitleMatches(
      fields.title.value,
      candidate,
      officialBrandAliases,
    )
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer names a foreign or ambiguous brand.`,
    );
  }
}

function verifyRetainedGtinOfferSource(
  candidate: CatalogueIntakeCandidate,
  retailer: string,
  evidence: ReviewedRetainedGtinOfferEvidence,
  bytes: Buffer,
) {
  if (
    !sha256Pattern.test(evidence.responseSha256) ||
    bytes.byteLength !== evidence.responseByteSize ||
    createHash("sha256").update(bytes).digest("hex") !== evidence.responseSha256
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} GTIN offer response bytes changed.`,
    );
  }

  const completeRecord =
    evidence.offerRecord.byteStart === 0 &&
    evidence.offerRecord.byteEnd === bytes.byteLength &&
    evidence.offerRecord.sourceText === bytes.toString("utf8") &&
    evidence.offerRecord.sourceFragmentSha256 === evidence.responseSha256;
  const retainedRecord = completeRecord
    ? verifiedCatalogueRetainedRecord(bytes, evidence.offerRecord)
    : undefined;
  if (!retainedRecord) {
    throw new Error(
      `${candidate.id} retained ${retailer} GTIN offer record must bind the complete response bytes.`,
    );
  }
  const source = bytes.toString("utf8");
  let product: Record<string, unknown>;
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    product = parsed as Record<string, unknown>;
  } catch {
    throw new Error(
      `${candidate.id} retained ${retailer} GTIN offer is not one JSON product record.`,
    );
  }

  const responseUrl = new URL(evidence.responseUrl);
  const productId = Number(
    responseUrl.pathname.split("/").filter(Boolean).at(-1),
  );
  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0 ||
    product.id !== productId ||
    typeof product.permalink !== "string" ||
    !sameRetainedUrl(product.permalink, evidence.listingUrl)
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} GTIN offer does not bind its API record to the listing.`,
    );
  }

  const fields = evidence.fields;
  if (
    !retainedOfferIdentityFieldPresent(
      source,
      fields.title,
      "application/json",
    ) ||
    !retainedOfferSizeFieldPresent(source, fields.size) ||
    (fields.packageVersion != null &&
      !retainedOfferFieldPresent(source, fields.packageVersion)) ||
    !retainedWooPriceFieldPresent(source, fields.price) ||
    !retainedOfferFieldPresent(source, fields.stock) ||
    ((fields.gtin.responseRole ?? "listing-response") === "listing-response" &&
      !retainedOfferFieldPresent(source, fields.gtin))
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} GTIN offer response does not contain every claimed field.`,
    );
  }
}

async function readCanonicalRetainedOffer(
  repositoryRoot: string,
  expectedRoot: string,
  relativePath: string,
  label: string,
) {
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  if (path.dirname(absolutePath) !== expectedRoot) {
    throw new Error(
      `${label} escapes the checked-in offer evidence directory.`,
    );
  }
  const stats = await lstat(absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} is not a regular checked-in evidence file.`);
  }
  const [rootRealPath, fileRealPath] = await Promise.all([
    realpath(expectedRoot),
    realpath(absolutePath),
  ]);
  if (path.dirname(fileRealPath) !== rootRealPath) {
    throw new Error(
      `${label} resolves outside the checked-in offer evidence directory.`,
    );
  }
  return readFile(absolutePath);
}

export async function verifyCatalogueIdentityEvidenceArtifacts(
  candidates: readonly CatalogueIntakeCandidate[],
  repositoryRoot = process.cwd(),
) {
  const evidenceRoot = path.resolve(
    repositoryRoot,
    "data/catalogue-identity-evidence",
  );
  const sourceEvidenceRoot = path.resolve(
    repositoryRoot,
    "data/catalogue-identity-source-evidence",
  );
  const offerSourceEvidenceRoot = path.resolve(
    repositoryRoot,
    "data/catalogue-offer-source-evidence",
  );
  let verified = 0;

  for (const candidate of candidates) {
    const evidence = candidate.identity.officialEvidence;
    if (!evidence) continue;
    const expectedRelativePath = `data/catalogue-identity-evidence/${candidate.id}.json`;
    if (evidence.snapshotPath !== expectedRelativePath) {
      throw new Error(
        `${candidate.id} identity evidence path is not canonical.`,
      );
    }
    const absolutePath = path.resolve(repositoryRoot, evidence.snapshotPath);
    if (path.dirname(absolutePath) !== evidenceRoot) {
      throw new Error(
        `${candidate.id} identity evidence escapes the checked-in evidence directory.`,
      );
    }
    const bytes = await readFile(absolutePath);
    const canonical = catalogueIdentityExtractionCanonicalJson(
      evidence.canonicalExtraction,
    );
    if (!bytes.equals(Buffer.from(canonical, "utf8"))) {
      throw new Error(
        `${candidate.id} identity evidence bytes do not match its canonical extraction.`,
      );
    }
    if (bytes.byteLength !== evidence.snapshotByteSize) {
      throw new Error(`${candidate.id} identity evidence byte size changed.`);
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== evidence.snapshotSha256) {
      throw new Error(`${candidate.id} identity evidence hash changed.`);
    }
    const extraction = evidence.canonicalExtraction;
    if (
      extraction.schemaVersion ===
        catalogueManufacturerSkuIdentityExtractionSchemaVersion ||
      extraction.schemaVersion ===
        catalogueManufacturerSkuBarcodeAliasIdentityExtractionSchemaVersion
    ) {
      const sourceExtension =
        extraction.sourceResponseMimeType === "text/html" ? "html" : "json";
      const expectedSourcePath = `data/catalogue-identity-source-evidence/${candidate.id}.${sourceExtension}`;
      if (extraction.sourceSnapshotPath !== expectedSourcePath) {
        throw new Error(
          `${candidate.id} retained official identity source path is not canonical.`,
        );
      }
      const sourcePath = path.resolve(
        repositoryRoot,
        extraction.sourceSnapshotPath,
      );
      if (path.dirname(sourcePath) !== sourceEvidenceRoot) {
        throw new Error(
          `${candidate.id} retained official identity source escapes its directory.`,
        );
      }
      const sourceBytes = await readFile(sourcePath);
      verifyRetainedManufacturerSource(candidate, extraction, sourceBytes);
      const officialBrandAliases = (
        extraction.fields.manufacturerBrandAliases ?? []
      ).map((alias) => alias.value);

      for (const offer of candidate.nigeria.exactOffers) {
        const offerEvidence = offer.evidence;
        if (
          !offerEvidence ||
          offerEvidence.schemaVersion !==
            catalogueExactOfferManufacturerSkuEvidenceSchemaVersion
        )
          continue;
        if (
          !offerEvidence.responseSnapshotPath ||
          !offerEvidence.offerRecord ||
          !offerEvidence.identityCorrelation ||
          !offerEvidence.fields.brand
        ) {
          throw new Error(
            `${candidate.id} retained ${offer.retailer} offer evidence is incomplete.`,
          );
        }
        const manufacturerOfferEvidence =
          offerEvidence as ReviewedManufacturerSkuOfferEvidence;
        const extension =
          manufacturerOfferEvidence.responseMimeType === "application/json"
            ? "json"
            : "html";
        const expectedOfferSourcePath =
          `data/catalogue-offer-source-evidence/${candidate.id}` +
          `--${retailerSlug(offer.retailer)}.${extension}`;
        if (
          manufacturerOfferEvidence.responseSnapshotPath !==
          expectedOfferSourcePath
        ) {
          throw new Error(
            `${candidate.id} retained ${offer.retailer} offer response path is not canonical.`,
          );
        }
        const offerSourcePath = path.resolve(
          repositoryRoot,
          manufacturerOfferEvidence.responseSnapshotPath,
        );
        if (path.dirname(offerSourcePath) !== offerSourceEvidenceRoot) {
          throw new Error(
            `${candidate.id} retained ${offer.retailer} offer response escapes its directory.`,
          );
        }
        const offerSourceBytes = await readFile(offerSourcePath);
        verifyRetainedManufacturerOfferSource(
          candidate,
          offer.retailer,
          manufacturerOfferEvidence,
          offerSourceBytes,
          officialBrandAliases,
        );
      }
    }

    for (const offer of candidate.nigeria.exactOffers) {
      const offerEvidence = offer.evidence;
      if (
        !offerEvidence ||
        offerEvidence.schemaVersion !==
          catalogueExactOfferRetainedGtinEvidenceSchemaVersion
      )
        continue;
      if (
        !offerEvidence.responseSnapshotPath ||
        !offerEvidence.offerRecord ||
        !offerEvidence.fields.gtin
      ) {
        throw new Error(
          `${candidate.id} retained ${offer.retailer} GTIN offer evidence is incomplete.`,
        );
      }
      const retainedGtinEvidence =
        offerEvidence as ReviewedRetainedGtinOfferEvidence;
      const expectedOfferSourcePath =
        `data/catalogue-offer-source-evidence/${candidate.id}` +
        `--${retailerSlug(offer.retailer)}.json`;
      if (
        retainedGtinEvidence.responseSnapshotPath !== expectedOfferSourcePath
      ) {
        throw new Error(
          `${candidate.id} retained ${offer.retailer} GTIN offer response path is not canonical.`,
        );
      }
      const offerSourceBytes = await readCanonicalRetainedOffer(
        repositoryRoot,
        offerSourceEvidenceRoot,
        retainedGtinEvidence.responseSnapshotPath,
        `${candidate.id} retained ${offer.retailer} GTIN offer`,
      );
      verifyRetainedGtinOfferSource(
        candidate,
        offer.retailer,
        retainedGtinEvidence,
        offerSourceBytes,
      );
    }
    verified += 1;
  }

  return verified;
}
