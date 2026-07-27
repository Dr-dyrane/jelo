import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  catalogueIdentityExtractionCanonicalJson,
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  type CatalogueIntakeCandidate,
  type CatalogueManufacturerSkuIdentityExtraction,
} from './intake-readiness';
import {
  catalogueExactOfferManufacturerSkuEvidenceSchemaVersion,
  type ReviewedManufacturerSkuExactOfferEvidence,
} from './market-evidence';
import {
  sourceTextNamesCatalogueBrandField,
  verifiedCatalogueRetainedRecord,
} from './retained-record';

const sha256Pattern = /^[0-9a-f]{64}$/;

const structuredIdentifierKey = (
  '(?:barcode(?:[_-]?(?:value|number))?'
  + '|gtin(?:[_-]?(?:8|12|13|14|value|number))?'
  + '|ean(?:[_-]?(?:8|13|value|number))?'
  + '|upc(?:[_-]?(?:a|e|value|number))?)'
);

/**
 * Detects machine-readable identifier keys, including common suffix/casing variants, without
 * treating ordinary editorial prose about barcodes or UPC standards as a published identifier.
 */
function structuredIdentifierKeyMatches(source: string) {
  const patterns = [
    // JSON, JSON-LD and inline JavaScript object keys.
    new RegExp(`(?:^|[{,;\\s])["']?(${structuredIdentifierKey})["']?\\s*:`, 'gi'),
    // HTML attributes such as itemprop="gtin13", name="ean13" or data-barcode-value="...".
    new RegExp(
      `\\b(?:itemprop|name|property|aria-label)\\s*=\\s*["'](${structuredIdentifierKey})["']`,
      'gi',
    ),
    new RegExp(`\\bdata-(${structuredIdentifierKey})\\s*=`, 'gi'),
    // Visible metadata labels, e.g. <dt>GTIN13</dt> or <span>Barcode value:</span>.
    new RegExp(`>\\s*(${structuredIdentifierKey})\\s*(?::\\s*)?<`, 'gi'),
    new RegExp(`(?:^|[\\n;])\\s*(${structuredIdentifierKey})\\s*:`, 'gi'),
  ];
  return patterns.flatMap(pattern => Array.from(source.matchAll(pattern)).map(match => ({
    term: match[1],
    index: match.index ?? -1,
  })));
}

function normalizedRetainedText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
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
  if (typeof field.value !== 'string') return false;
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  const normalizedValue = normalizedRetainedText(field.value);
  return normalizedSourceText.length >= 3
    && normalizedValue.length > 0
    && normalizedSourceText.includes(normalizedValue)
    && retainedTextSegments(source).some(segment => segment.includes(normalizedSourceText));
}

function parsedRetainedJsonObjects(source: string) {
  const parsedObjects: Array<Record<string, unknown>> = [];
  const objectStarts: number[] = [];
  let quote: '"' | "'" | '`' | undefined;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (objectStarts.length === 0) {
      if (character === '{') objectStarts.push(index);
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') {
      objectStarts.push(index);
      continue;
    }
    if (character !== '}') continue;

    const objectStart = objectStarts.pop();
    if (objectStart === undefined) continue;
    const objectSource = source.slice(objectStart, index + 1);

    try {
      const parsed = JSON.parse(objectSource) as unknown;
      if (
        parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
      ) parsedObjects.push(parsed as Record<string, unknown>);
    } catch {
      // Retained JavaScript may contain non-JSON objects. Only structurally parsed JSON records
      // can prove direct field relationships without executing retained page code.
    }
  }

  return parsedObjects;
}

function retainedObjectHasSkuAndNullBarcode(source: string, manufacturerSku: string) {
  return parsedRetainedJsonObjects(source).some(parsed => (
    Object.hasOwn(parsed, 'sku')
    && Object.hasOwn(parsed, 'barcode')
    && parsed.sku === manufacturerSku
    && parsed.barcode === null
  ));
}

const catalogueBrandFieldLabels = new Set([
  'brand',
  'brand name',
  'vendor',
  'manufacturer',
  'manufacturer name',
]);

function retainedExplicitCatalogueBrandFieldPresent(
  source: string,
  field: { value: string; sourceText: string },
) {
  if (!sourceTextNamesCatalogueBrandField(field.sourceText, field.value)) return false;
  const normalizedValue = normalizedRetainedText(field.value);
  const normalizedSourceText = normalizedRetainedText(field.sourceText);

  const jsonFieldPresent = parsedRetainedJsonObjects(source).some(record => (
    Object.entries(record).some(([key, rawValue]) => {
      if (!catalogueBrandFieldLabels.has(normalizedRetainedText(key))) return false;
      if (typeof rawValue === 'string') {
        return normalizedRetainedText(rawValue) === normalizedValue;
      }
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return false;
      const name = (rawValue as Record<string, unknown>).name;
      return typeof name === 'string' && normalizedRetainedText(name) === normalizedValue;
    })
  ));
  if (jsonFieldPresent) return true;

  const segments = retainedTextSegments(source);
  if (segments.includes(normalizedSourceText)) return true;
  return segments.some((segment, index) => (
    catalogueBrandFieldLabels.has(segment)
    && segments[index + 1] === normalizedValue
  ));
}

function verifyRetainedManufacturerSource(
  candidateId: string,
  extraction: CatalogueManufacturerSkuIdentityExtraction,
  bytes: Buffer,
) {
  if (
    !sha256Pattern.test(extraction.sourceResponseSha256)
    || bytes.byteLength !== extraction.sourceResponseByteSize
    || createHash('sha256').update(bytes).digest('hex') !== extraction.sourceResponseSha256
  ) {
    throw new Error(`${candidateId} retained official identity source bytes changed.`);
  }

  const source = bytes.toString('utf8');
  const retainedRecord = verifiedCatalogueRetainedRecord(bytes, extraction.productRecord);
  if (!retainedRecord) {
    throw new Error(`${candidateId} retained official product record changed or is out of bounds.`);
  }
  const productRecordSource = retainedRecord.toString('utf8');
  const fields = extraction.fields;
  if (
    !retainedExplicitCatalogueBrandFieldPresent(
      productRecordSource,
      fields.manufacturerBrand,
    )
    || !(fields.manufacturerBrandAliases ?? []).every(alias => (
      retainedExplicitCatalogueBrandFieldPresent(productRecordSource, alias)
    ))
    || !retainedExtractionFieldPresent(productRecordSource, fields.manufacturerSku)
    || !normalizedRetainedText(fields.manufacturerSku.sourceText)
      .includes(normalizedRetainedText(fields.manufacturerSku.label))
    || !retainedExtractionFieldPresent(productRecordSource, fields.variant)
    || !retainedExtractionFieldPresent(productRecordSource, fields.size)
    || !retainedExtractionFieldPresent(productRecordSource, fields.packageVersion)
  ) {
    throw new Error(
      `${candidateId} retained official identity source does not contain every claimed product field.`,
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
    return;
  }

  const manufacturerSku = extraction.fields.manufacturerSku.value;
  const nullBarcodePattern = /["']?barcode["']?\s*:\s*null/gi;
  if (!retainedObjectHasSkuAndNullBarcode(productRecordSource, manufacturerSku)) {
    throw new Error(`${candidateId} retained official identity source lost its null-barcode variant.`);
  }

  // The one explicit null barcode key is allowed. Any other barcode/GTIN/EAN/UPC identifier term
  // anywhere in the complete retained representation makes the no-GTIN claim ambiguous.
  const withoutReviewedNullBarcode = source.replace(nullBarcodePattern, '');
  if (structuredIdentifierKeyMatches(withoutReviewedNullBarcode).length > 0) {
    throw new Error(`${candidateId} retained official identity source publishes another identifier.`);
  }
}

type ReviewedManufacturerSkuOfferEvidence = ReviewedManufacturerSkuExactOfferEvidence;

function retailerSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function retainedOfferFieldPresent(
  source: string,
  field: { value: unknown; sourceText: string },
) {
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  const valuePresent = typeof field.value === 'number'
    ? field.sourceText.replace(/\D/g, '').includes(String(field.value))
    : normalizedSourceText.includes(normalizedRetainedText(String(field.value)));
  return normalizedSourceText.length >= 3
    && valuePresent
    && retainedTextSegments(source).some(segment => segment.includes(normalizedSourceText));
}

function retainedOfferIdentityFieldPresent(
  source: string,
  field: { value: string; sourceText: string },
  mimeType: ReviewedManufacturerSkuOfferEvidence['responseMimeType'],
) {
  const normalizedValue = normalizedRetainedText(field.value);
  const normalizedSourceText = normalizedRetainedText(field.sourceText);
  if (
    normalizedValue.length === 0
    || normalizedSourceText.length < 3
    || !normalizedSourceText.includes(normalizedValue)
  ) return false;

  if (mimeType === 'application/json') {
    try {
      const primitiveStrings: string[] = [];
      const visit = (value: unknown) => {
        if (typeof value === 'string') {
          primitiveStrings.push(normalizedRetainedText(value));
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (value && typeof value === 'object') {
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
    .some(brand => (
      normalizedTitle === normalizedVariant
      || normalizedTitle === `${brand} ${normalizedVariant}`
      || (
        normalizedVariant.startsWith(`${brand} `)
        && normalizedTitle === normalizedVariant
      )
    ));
}

function verifyRetainedManufacturerOfferSource(
  candidate: CatalogueIntakeCandidate,
  retailer: string,
  evidence: ReviewedManufacturerSkuOfferEvidence,
  bytes: Buffer,
  officialBrandAliases: readonly string[],
) {
  if (
    !sha256Pattern.test(evidence.responseSha256)
    || bytes.byteLength !== evidence.responseByteSize
    || createHash('sha256').update(bytes).digest('hex') !== evidence.responseSha256
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer response bytes changed.`,
    );
  }

  const retainedRecord = verifiedCatalogueRetainedRecord(bytes, evidence.offerRecord);
  if (!retainedRecord) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer record changed or is out of bounds.`,
    );
  }
  const source = retainedRecord.toString('utf8');
  const fields = evidence.fields;
  if (
    !retainedExplicitCatalogueBrandFieldPresent(
      source,
      fields.brand,
    )
    || !retainedOfferIdentityFieldPresent(
      source,
      fields.title,
      evidence.responseMimeType,
    )
    || !retainedOfferFieldPresent(source, fields.size)
    || (fields.packageVersion != null
      && !retainedOfferFieldPresent(source, fields.packageVersion))
    || !retainedOfferFieldPresent(source, fields.price)
    || !retainedOfferFieldPresent(source, fields.stock)
  ) {
    throw new Error(
      `${candidate.id} retained ${retailer} offer response does not contain every claimed field.`,
    );
  }

  const allowedBrands = [candidate.brand, ...officialBrandAliases]
    .map(normalizedRetainedText);
  if (
    !allowedBrands.includes(normalizedRetainedText(fields.brand.value))
    || !manufacturerOfferTitleMatches(
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

export async function verifyCatalogueIdentityEvidenceArtifacts(
  candidates: readonly CatalogueIntakeCandidate[],
  repositoryRoot = process.cwd(),
) {
  const evidenceRoot = path.resolve(repositoryRoot, 'data/catalogue-identity-evidence');
  const sourceEvidenceRoot = path.resolve(
    repositoryRoot,
    'data/catalogue-identity-source-evidence',
  );
  const offerSourceEvidenceRoot = path.resolve(
    repositoryRoot,
    'data/catalogue-offer-source-evidence',
  );
  let verified = 0;

  for (const candidate of candidates) {
    const evidence = candidate.identity.officialEvidence;
    if (!evidence) continue;
    const expectedRelativePath = `data/catalogue-identity-evidence/${candidate.id}.json`;
    if (evidence.snapshotPath !== expectedRelativePath) {
      throw new Error(`${candidate.id} identity evidence path is not canonical.`);
    }
    const absolutePath = path.resolve(repositoryRoot, evidence.snapshotPath);
    if (path.dirname(absolutePath) !== evidenceRoot) {
      throw new Error(`${candidate.id} identity evidence escapes the checked-in evidence directory.`);
    }
    const bytes = await readFile(absolutePath);
    const canonical = catalogueIdentityExtractionCanonicalJson(evidence.canonicalExtraction);
    if (!bytes.equals(Buffer.from(canonical, 'utf8'))) {
      throw new Error(`${candidate.id} identity evidence bytes do not match its canonical extraction.`);
    }
    if (bytes.byteLength !== evidence.snapshotByteSize) {
      throw new Error(`${candidate.id} identity evidence byte size changed.`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== evidence.snapshotSha256) {
      throw new Error(`${candidate.id} identity evidence hash changed.`);
    }
    const extraction = evidence.canonicalExtraction;
    if (extraction.schemaVersion === catalogueManufacturerSkuIdentityExtractionSchemaVersion) {
      const expectedSourcePath = `data/catalogue-identity-source-evidence/${candidate.id}.html`;
      if (extraction.sourceSnapshotPath !== expectedSourcePath) {
        throw new Error(`${candidate.id} retained official identity source path is not canonical.`);
      }
      const sourcePath = path.resolve(repositoryRoot, extraction.sourceSnapshotPath);
      if (path.dirname(sourcePath) !== sourceEvidenceRoot) {
        throw new Error(`${candidate.id} retained official identity source escapes its directory.`);
      }
      const sourceBytes = await readFile(sourcePath);
      verifyRetainedManufacturerSource(candidate.id, extraction, sourceBytes);
      const officialBrandAliases = (
        extraction.fields.manufacturerBrandAliases ?? []
      ).map(alias => alias.value);

      for (const offer of candidate.nigeria.exactOffers) {
        const offerEvidence = offer.evidence;
        if (
          !offerEvidence
          || offerEvidence.schemaVersion
            !== catalogueExactOfferManufacturerSkuEvidenceSchemaVersion
        ) continue;
        if (
          !offerEvidence.responseSnapshotPath
          || !offerEvidence.offerRecord
          || !offerEvidence.identityCorrelation
          || !offerEvidence.fields.brand
        ) {
          throw new Error(
            `${candidate.id} retained ${offer.retailer} offer evidence is incomplete.`,
          );
        }
        const manufacturerOfferEvidence =
          offerEvidence as ReviewedManufacturerSkuOfferEvidence;
        const extension = manufacturerOfferEvidence.responseMimeType === 'application/json'
          ? 'json'
          : 'html';
        const expectedOfferSourcePath = (
          `data/catalogue-offer-source-evidence/${candidate.id}`
          + `--${retailerSlug(offer.retailer)}.${extension}`
        );
        if (manufacturerOfferEvidence.responseSnapshotPath !== expectedOfferSourcePath) {
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
    verified += 1;
  }

  return verified;
}
