import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { z } from 'zod';

const candidatePath = path.resolve(process.cwd(), '.cache/openbeautyfacts-candidates.json');
const candidateMetaPath = path.resolve(process.cwd(), '.cache/openbeautyfacts-candidate-meta.json');
const progressPath = path.resolve(process.cwd(), '.cache/openbeautyfacts-mirror-progress.json');
const outputPath = path.resolve(process.cwd(), '.cache/openbeautyfacts-mirrored-candidates.json');
const outputMetaPath = path.resolve(process.cwd(), '.cache/openbeautyfacts-mirrored-candidate-meta.json');
const TARGET = 977;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

const candidateSchema = z.object({
  source: z.literal('open-beauty-facts'),
  sourceProductId: z.string(),
  barcode: z.string(),
  brand: z.string(),
  name: z.string(),
  quantity: z.string(),
  category: z.enum(['Face care', 'Hair & scalp', 'Body care', 'Makeup', 'Fragrance', 'Personal care']),
  sourceCategories: z.array(z.string()),
  countries: z.array(z.string()),
  sourceUrl: z.string().url(),
  sourceUpdatedAt: z.string().datetime(),
  sourceRetrievedAt: z.string().datetime(),
  sourceSchemaVersion: z.literal('obf-jsonl-v1'),
  rawPayloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  ingredientLabelSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sourceImageUrl: z.string().url(),
  ingredientImageUrl: z.string().url().optional(),
  imageLicense: z.literal('CC BY-SA 3.0'),
  imageAttribution: z.literal('Open Beauty Facts contributors'),
  dataLicense: z.literal('ODbL 1.0'),
  contentLicense: z.literal('Database Contents License 1.0'),
  clinicalReviewStatus: z.literal('not-reviewed'),
  sourcePhotoValidated: z.boolean(),
  sourceIngredientsComplete: z.boolean(),
  qualityScore: z.number().int(),
});

type Candidate = z.infer<typeof candidateSchema>;

export type MirroredExternalProduct = Candidate & {
  sourceSnapshotSha256: string;
  canonicalImageUrl: string;
  sourceImageSha256: string;
  imageSha256: string;
  imageMimeType: 'image/webp';
  imageWidth: number;
  imageHeight: number;
  imageByteSize: number;
};

type Progress = {
  sourceSnapshotSha256: string;
  products: MirroredExternalProduct[];
  failures: Array<{ barcode: string; reason: string }>;
};

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadProgress(snapshotSha256: string): Promise<Progress> {
  try {
    const progress = JSON.parse(await readFile(progressPath, 'utf8')) as Progress;
    if (progress.sourceSnapshotSha256 === snapshotSha256) return progress;
  } catch {
    // Start a new mirror below.
  }
  return { sourceSnapshotSha256: snapshotSha256, products: [], failures: [] };
}

async function saveProgress(progress: Progress) {
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
}

async function mirror(candidate: Candidate, sourceSnapshotSha256: string): Promise<MirroredExternalProduct> {
  const source = new URL(candidate.sourceImageUrl);
  if (source.protocol !== 'https:' || source.hostname !== 'images.openbeautyfacts.org') {
    throw new Error('source image host is not approved');
  }
  const response = await fetch(source, {
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1',
      'User-Agent': 'JeloCareCatalogueMirror/1.0 (hello@jelocare.com)',
    },
  });
  if (!response.ok) throw new Error(`source returned ${response.status}`);
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!allowedTypes.has(contentType)) throw new Error(`unsupported content type ${contentType || 'unknown'}`);
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error('source image exceeds 10 MB');
  const sourceBytes = Buffer.from(await response.arrayBuffer());
  if (!sourceBytes.length || sourceBytes.length > MAX_SOURCE_BYTES) throw new Error('source image is empty or exceeds 10 MB');

  const sourceImageSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  const imageBytes = await sharp(sourceBytes, { animated: false })
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  const metadata = await sharp(imageBytes).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100) {
    throw new Error('image dimensions are too small');
  }
  const imageSha256 = createHash('sha256').update(imageBytes).digest('hex');
  const pathname = `catalogue/open-beauty-facts/${candidate.barcode}/front-${imageSha256.slice(0, 12)}.webp`;
  const blob = await put(pathname, imageBytes, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31_536_000,
  });

  return {
    ...candidate,
    sourceSnapshotSha256,
    canonicalImageUrl: blob.url,
    sourceImageSha256,
    imageSha256,
    imageMimeType: 'image/webp',
    imageWidth: metadata.width,
    imageHeight: metadata.height,
    imageByteSize: imageBytes.length,
  };
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required.');
  const candidates = z.array(candidateSchema).parse(JSON.parse(await readFile(candidatePath, 'utf8')));
  const candidateMeta = JSON.parse(await readFile(candidateMetaPath, 'utf8')) as { sourceSnapshotSha256: string; [key: string]: unknown };
  const progress = await loadProgress(candidateMeta.sourceSnapshotSha256);
  const completed = new Set(progress.products.map(product => product.barcode));
  const failed = new Set(progress.failures.map(failure => failure.barcode));
  const pending = candidates.filter(candidate => !completed.has(candidate.barcode) && !failed.has(candidate.barcode));
  const concurrency = 6;

  for (let offset = 0; offset < pending.length && progress.products.length < TARGET; offset += concurrency) {
    const batch = pending.slice(offset, offset + concurrency);
    const results = await Promise.allSettled(batch.map(candidate => mirror(candidate, candidateMeta.sourceSnapshotSha256)));
    results.forEach((result, index) => {
      const candidate = batch[index];
      if (result.status === 'fulfilled') {
        progress.products.push(result.value);
        console.log(`✓ ${progress.products.length}/${TARGET} ${candidate.barcode} ${candidate.brand} ${candidate.name}`);
      } else {
        const reason = failureMessage(result.reason);
        progress.failures.push({ barcode: candidate.barcode, reason });
        console.error(`✗ ${candidate.barcode} ${reason}`);
      }
    });
    await saveProgress(progress);
  }

  const published = progress.products.slice(0, TARGET);
  if (published.length !== TARGET) {
    throw new Error(`Mirrored ${published.length}/${TARGET} products; ${progress.failures.length} failed and the reserve is exhausted.`);
  }
  published.sort((left, right) => right.qualityScore - left.qualityScore || left.barcode.localeCompare(right.barcode));

  const categoryCounts = Object.fromEntries(
    [...new Set(published.map(product => product.category))].sort().map(category => [category, published.filter(product => product.category === category).length]),
  );
  const metadata = {
    ...candidateMeta,
    reviewedCount: 23,
    communitySourcedCount: 0,
    publicCatalogueCount: 23,
    candidatePoolVisibility: 'private',
    catalogueExposurePolicy: 'explicit-approval-only',
    mirroredImageCount: TARGET,
    mirrorFailureCount: progress.failures.length,
    sourcePhotoValidatedCount: published.filter(product => product.sourcePhotoValidated).length,
    sourceIngredientsCompleteCount: published.filter(product => product.sourceIngredientsComplete).length,
    categoryCounts,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(outputPath, `${JSON.stringify(published, null, 2)}\n`, 'utf8');
  await writeFile(outputMetaPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(`Mirrored ${TARGET} private candidates. No catalogue records were published.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
