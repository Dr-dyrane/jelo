import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { canonicalGtin, isValidGtin } from '../lib/catalogue/gtin';

const SOURCE_URL = 'https://static.openbeautyfacts.org/data/openbeautyfacts-products.jsonl.gz';
const SOURCE_PAGE = 'https://world.openbeautyfacts.org/data';
const CACHE_PATH = path.resolve(process.cwd(), '.cache/openbeautyfacts-products.jsonl.gz');
const CANDIDATE_PATH = path.resolve(process.cwd(), '.cache/openbeautyfacts-candidates.json');
const META_PATH = path.resolve(process.cwd(), '.cache/openbeautyfacts-candidate-meta.json');
const DEFAULT_TARGET = 977;
// Background extraction quarantines materially more records than a simple
// mirror job. Keep the complete accepted pool by default so a fresh run can
// still produce 977 display-worthy, human-reviewed packshots.
const DEFAULT_RESERVE = 3_000;
const MIN_UPDATED_AT = Date.parse('2018-01-01T00:00:00Z') / 1000;

const rawImageSchema = z.object({
  rev: z.union([z.string(), z.number()]).optional(),
  sizes: z.record(z.string(), z.unknown()).optional(),
  uploader: z.string().optional(),
}).passthrough();

const rawProductSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  url: z.string().optional(),
  product_name: z.string().optional(),
  product_name_en: z.string().optional(),
  brands: z.string().optional(),
  quantity: z.string().optional(),
  categories: z.string().optional(),
  categories_tags: z.array(z.string()).optional(),
  categories_en: z.string().optional(),
  countries_tags: z.array(z.string()).optional(),
  states_tags: z.array(z.string()).optional(),
  data_quality_errors_tags: z.array(z.string()).optional(),
  ingredients_text: z.string().optional(),
  ingredients_text_en: z.string().optional(),
  image_front_url: z.string().optional(),
  image_url: z.string().optional(),
  image_ingredients_url: z.string().optional(),
  images: z.record(z.string(), rawImageSchema).optional(),
  lang: z.string().optional(),
  last_modified_t: z.union([z.number(), z.string()]).optional(),
  unique_scans_n: z.union([z.number(), z.string()]).optional(),
  completeness: z.union([z.number(), z.string()]).optional(),
}).passthrough();

type RawProduct = z.infer<typeof rawProductSchema>;

export type ExternalCandidate = {
  source: 'open-beauty-facts';
  sourceProductId: string;
  barcode: string;
  brand: string;
  name: string;
  quantity: string;
  category: 'Face care' | 'Hair & scalp' | 'Body care' | 'Makeup' | 'Fragrance' | 'Personal care';
  sourceCategories: string[];
  countries: string[];
  sourceUrl: string;
  sourceUpdatedAt: string;
  sourceRetrievedAt: string;
  sourceSchemaVersion: 'obf-jsonl-v1';
  rawPayloadSha256: string;
  ingredientLabelSha256?: string;
  sourceImageUrl: string;
  ingredientImageUrl?: string;
  imageLicense: 'CC BY-SA 3.0';
  imageAttribution: 'Open Beauty Facts contributors';
  dataLicense: 'ODbL 1.0';
  contentLicense: 'Database Contents License 1.0';
  clinicalReviewStatus: 'not-reviewed';
  sourcePhotoValidated: boolean;
  sourceIngredientsComplete: boolean;
  qualityScore: number;
};

type RejectionReason =
  | 'schema'
  | 'barcode'
  | 'identity'
  | 'quantity'
  | 'taxonomy'
  | 'front-image'
  | 'completion-state'
  | 'quality-state'
  | 'stale'
  | 'duplicate';

const identityCompletionSignals = [
  'en:product-name-completed',
  'en:brands-completed',
  'en:categories-completed',
  'en:quantity-completed',
  'en:photos-uploaded',
];

const rejectStates = [
  'en:product-name-to-be-completed',
  'en:brands-to-be-completed',
  'en:categories-to-be-completed',
  'en:quantity-to-be-completed',
];

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

function clean(value: string | undefined, max = 180) {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalized(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validQuantity(value: string) {
  return /\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l|mg|g|kg|oz|fl\.?\s*oz|count|pcs?|pieces?|pack)\b/i.test(value);
}

function sourceImage(value: string | undefined) {
  const cleaned = clean(value, 500);
  try {
    const url = new URL(cleaned);
    return url.protocol === 'https:' && url.hostname === 'images.openbeautyfacts.org' ? url.toString() : '';
  } catch {
    return '';
  }
}

function imagePath(barcode: string) {
  const padded = barcode.padStart(13, '0');
  return `${padded.slice(0, 3)}/${padded.slice(3, 6)}/${padded.slice(6, 9)}/${padded.slice(9)}`;
}

function selectedImage(product: RawProduct, barcode: string, kind: 'front' | 'ingredients') {
  const direct = kind === 'front'
    ? sourceImage(product.image_front_url || product.image_url)
    : sourceImage(product.image_ingredients_url);
  if (direct) return direct;

  const images = product.images ?? {};
  const preferred = [`${kind}_en`, product.lang ? `${kind}_${product.lang}` : ''];
  const key = preferred.find(value => value && images[value])
    ?? Object.keys(images).filter(value => value.startsWith(`${kind}_`)).sort()[0];
  if (!key) return '';
  const image = images[key];
  const revision = clean(String(image.rev ?? ''), 12);
  if (!/^\d+$/.test(revision)) return '';
  const size = image.sizes?.['400'] ? '400' : image.sizes?.['200'] ? '200' : '';
  if (!size) return '';
  return `https://images.openbeautyfacts.org/images/products/${imagePath(barcode)}/${key}.${revision}.${size}.jpg`;
}

function mapCategory(product: RawProduct): ExternalCandidate['category'] | null {
  const text = normalized([
    product.product_name_en,
    product.product_name,
    product.categories,
    product.categories_en,
    ...(product.categories_tags ?? []),
  ].filter(Boolean).join(' '));

  const mappings: Array<[ExternalCandidate['category'], RegExp]> = [
    ['Hair & scalp', /\b(shampoo|conditioner|hair|scalp|coiff|capilla|cheveux|haar|cabello|pelo|dandruff|styling)\b/],
    ['Fragrance', /\b(perfume|parfum|fragrance|cologne|eau de toilette|eau de parfum)\b/],
    ['Makeup', /\b(makeup|make up|lipstick|lip gloss|mascara|foundation|concealer|eyeshadow|blush|cosmetic pencils|nail polish)\b/],
    ['Body care', /\b(body|hand|hands|foot|feet|soap|shower|bath|deodorant|antiperspirant|underarm|lotion|body wash|gel douche|savon)\b/],
    ['Face care', /\b(face|facial|serum|moisturi|cleanser|sunscreen|sun screen|spf|toner|micellar|eye cream|face cream|skin care|skincare|mask)\b/],
    ['Personal care', /\b(oral|tooth|toothpaste|mouthwash|shav|razor|hygiene|intimate|baby|diaper|cotton|personal care)\b/],
  ];
  return mappings.find(([, expression]) => expression.test(text))?.[0] ?? null;
}

function sourceRecordUrl(product: RawProduct, barcode: string) {
  try {
    const candidate = new URL(clean(product.url, 500));
    if (candidate.hostname.endsWith('openbeautyfacts.org')) return `https://world.openbeautyfacts.org/product/${barcode}`;
  } catch {
    // Use the canonical source record below.
  }
  return `https://world.openbeautyfacts.org/product/${barcode}`;
}

function qualityScore(product: RawProduct, lastModified: number, hasIngredients: boolean, hasIngredientImage: boolean) {
  const completeness = Number(product.completeness ?? 0);
  const scans = Number(product.unique_scans_n ?? 0);
  const ageDays = Math.max(0, (Date.now() / 1000 - lastModified) / 86_400);
  return Math.round(
    completeness * 1000
      + Math.log10(Math.max(1, scans) + 1) * 80
      + Math.max(0, 160 - ageDays / 10)
      + (product.states_tags?.includes('en:photos-validated') ? 180 : 0)
      + (hasIngredients ? 110 : 0)
      + (hasIngredientImage ? 70 : 0)
      - (product.data_quality_errors_tags?.length ?? 0) * 30,
  );
}

function assess(line: string, retrievedAt: string): { candidate?: ExternalCandidate; reason?: RejectionReason } {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(line);
  } catch {
    return { reason: 'schema' };
  }
  const parsed = rawProductSchema.safeParse(parsedJson);
  if (!parsed.success) return { reason: 'schema' };
  const product = parsed.data;
  const barcode = clean(product.code, 20);
  if (!isValidGtin(barcode)) return { reason: 'barcode' };

  const name = clean(product.product_name_en || product.product_name, 140);
  const brand = clean(product.brands?.split(',')[0], 80);
  if (name.length < 3 || brand.length < 2 || normalized(name) === normalized(brand) || /^(unknown|test|product|cosmetic|beauty)$/i.test(name)) return { reason: 'identity' };

  const quantity = clean(product.quantity, 48);
  if (!validQuantity(quantity)) return { reason: 'quantity' };
  const category = mapCategory(product);
  if (!category) return { reason: 'taxonomy' };

  const ingredients = clean(product.ingredients_text_en || product.ingredients_text, 20_000);
  const sourceImageUrl = selectedImage(product, barcode, 'front');
  if (!sourceImageUrl) return { reason: 'front-image' };
  const ingredientImageUrl = selectedImage(product, barcode, 'ingredients');

  const states = new Set(product.states_tags ?? []);
  if (!identityCompletionSignals.every(signal => states.has(signal))) return { reason: 'completion-state' };
  if (rejectStates.some(signal => states.has(signal)) || (product.data_quality_errors_tags?.length ?? 0) > 0) return { reason: 'quality-state' };

  const lastModified = Number(product.last_modified_t ?? 0);
  if (!Number.isFinite(lastModified) || lastModified < MIN_UPDATED_AT) return { reason: 'stale' };

  const sourceCategories = Array.from(new Set((product.categories_tags ?? []).map(value => clean(value.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' '), 80)).filter(Boolean))).slice(0, 12);
  const countries = Array.from(new Set((product.countries_tags ?? []).map(value => clean(value.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' '), 60)).filter(Boolean))).slice(0, 12);

  return {
    candidate: {
      source: 'open-beauty-facts',
      sourceProductId: barcode,
      barcode,
      brand,
      name,
      quantity,
      category,
      sourceCategories,
      countries,
      sourceUrl: sourceRecordUrl(product, barcode),
      sourceUpdatedAt: new Date(lastModified * 1000).toISOString(),
      sourceRetrievedAt: retrievedAt,
      sourceSchemaVersion: 'obf-jsonl-v1',
      rawPayloadSha256: createHash('sha256').update(line).digest('hex'),
      ingredientLabelSha256: ingredients.length >= 20 ? createHash('sha256').update(ingredients).digest('hex') : undefined,
      sourceImageUrl,
      ingredientImageUrl: ingredientImageUrl || undefined,
      imageLicense: 'CC BY-SA 3.0',
      imageAttribution: 'Open Beauty Facts contributors',
      dataLicense: 'ODbL 1.0',
      contentLicense: 'Database Contents License 1.0',
      clinicalReviewStatus: 'not-reviewed',
      sourcePhotoValidated: states.has('en:photos-validated'),
      sourceIngredientsComplete: states.has('en:ingredients-completed') && ingredients.length >= 20,
      qualityScore: qualityScore(product, lastModified, ingredients.length >= 20, Boolean(ingredientImageUrl)),
    },
  };
}

async function downloadSnapshot(force: boolean) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  if (!force) {
    try {
      const details = await stat(CACHE_PATH);
      if (details.size > 1_000_000) return CACHE_PATH;
    } catch {
      // Download below.
    }
  }

  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'JeloCareCatalogueImporter/1.0 (hello@dyrane.tech)' },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body) throw new Error(`Open Beauty Facts export returned ${response.status}.`);
  const temporary = `${CACHE_PATH}.partial`;
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary));
  await rename(temporary, CACHE_PATH);
  return CACHE_PATH;
}

async function snapshotHash(file: string) {
  const digest = createHash('sha256');
  const stream = createReadStream(file);
  for await (const chunk of stream) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

async function main() {
  const target = Number(option('target') ?? DEFAULT_TARGET);
  const reserve = Number(option('reserve') ?? DEFAULT_RESERVE);
  if (!Number.isInteger(target) || target < 1) throw new Error('Target must be a positive integer.');
  const input = option('input') ? path.resolve(process.cwd(), option('input')!) : await downloadSnapshot(process.argv.includes('--force-download'));
  const retrievedAt = new Date().toISOString();
  const rejectionCounts = new Map<RejectionReason, number>();
  const seenGtins = new Set<string>();
  const candidates: ExternalCandidate[] = [];
  let scanned = 0;

  const compressed = createReadStream(input);
  const gunzip = createGunzip();
  const lines = readline.createInterface({ input: compressed.pipe(gunzip), crlfDelay: Infinity });
  for await (const line of lines) {
    scanned += 1;
    const result = assess(line, retrievedAt);
    if (!result.candidate) {
      const reason = result.reason ?? 'schema';
      rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1);
      continue;
    }
    const candidate = result.candidate;
    const gtin = canonicalGtin(candidate.barcode);
    if (seenGtins.has(gtin)) {
      rejectionCounts.set('duplicate', (rejectionCounts.get('duplicate') ?? 0) + 1);
      continue;
    }
    seenGtins.add(gtin);
    candidates.push(candidate);
  }

  candidates.sort((left, right) => right.qualityScore - left.qualityScore || left.barcode.localeCompare(right.barcode));
  const selected = candidates.slice(0, target + reserve);
  const compressedSha256 = await snapshotHash(input);
  const candidatePayload = `${JSON.stringify(selected, null, 2)}\n`;
  const metadata = {
    source: 'Open Beauty Facts',
    sourcePage: SOURCE_PAGE,
    sourceSnapshotUrl: SOURCE_URL,
    sourceSnapshotFilename: path.basename(input),
    sourceSnapshotSha256: compressedSha256,
    sourceRetrievedAt: retrievedAt,
    requestedPublishedCount: target,
    reserveCount: Math.max(0, selected.length - target),
    scannedCount: scanned,
    acceptedCount: candidates.length,
    candidateCount: selected.length,
    candidatePoolVisibility: 'private',
    catalogueExposurePolicy: 'explicit-approval-only',
    qualityScorePurpose: 'candidate-prioritization-only',
    rejected: Object.fromEntries([...rejectionCounts.entries()].sort()),
    databaseLicense: 'ODbL 1.0',
    contentLicense: 'Database Contents License 1.0',
    imageLicense: 'CC BY-SA 3.0',
    candidateManifestSha256: createHash('sha256').update(candidatePayload).digest('hex'),
  };

  console.log(JSON.stringify(metadata, null, 2));
  if (selected.length < target) {
    throw new Error(`Only ${selected.length} products passed the acceptance gate; ${target} are required. Do not lower the gate silently.`);
  }
  if (!process.argv.includes('--dry-run')) {
    const candidateTemporary = `${CANDIDATE_PATH}.partial`;
    const metadataTemporary = `${META_PATH}.partial`;
    await writeFile(candidateTemporary, candidatePayload, 'utf8');
    await writeFile(metadataTemporary, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    await rename(candidateTemporary, CANDIDATE_PATH);
    await rename(metadataTemporary, META_PATH);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
