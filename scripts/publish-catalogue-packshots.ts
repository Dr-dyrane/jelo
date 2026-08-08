import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import sharp from "sharp";
import {
  assertPublishedPackshotRelease,
  candidateSha256,
  packshotReviewScope,
  type PackshotReleaseMetadata,
} from "../lib/catalogue/packshot-release";
import { sha256 } from "../lib/crypto/hashing";

type Candidate = {
  source: "open-beauty-facts";
  sourceProductId: string;
  barcode: string;
  brand: string;
  name: string;
  quantity: string;
  category:
    | "Face care"
    | "Hair & scalp"
    | "Body care"
    | "Makeup"
    | "Fragrance"
    | "Personal care";
  sourceCategories: string[];
  countries: string[];
  sourceUrl: string;
  sourceUpdatedAt: string;
  sourceRetrievedAt: string;
  sourceSchemaVersion: "obf-jsonl-v1";
  rawPayloadSha256: string;
  ingredientLabelSha256?: string;
  sourceImageUrl: string;
  ingredientImageUrl?: string;
  imageLicense: "CC BY-SA 3.0";
  imageAttribution: "Open Beauty Facts contributors";
  dataLicense: "ODbL 1.0";
  contentLicense: "Database Contents License 1.0";
  clinicalReviewStatus: "not-reviewed";
  sourcePhotoValidated: boolean;
  sourceIngredientsComplete: boolean;
  qualityScore: number;
};

type PackshotAudit = {
  barcode: string;
  brand: string;
  name: string;
  source_url: string;
  full_source_url: string;
  source_sha256: string;
  source_cache_path: string;
  status: "ready" | "review" | "quarantine";
  source_width: number;
  source_height: number;
  output_path: string;
  output_sha256: string;
  output_bytes: number;
  processing_model: string;
  processing_model_sha256?: string;
  processing_version: string;
  processing_provider?: string;
};

type SelectedItem = {
  candidate: Candidate;
  audit: PackshotAudit;
  candidateSha256: string;
  reviewSourceSha256: string;
  pipelineFingerprint: string;
};

type Selection = {
  schemaVersion: 2;
  releaseSha256: string;
  selectionSha256: string;
  target: number;
  auditSchemaVersion: 1 | 2;
  auditManifestSha256: string;
  candidateManifestSha256: string;
  candidateMetadataSha256: string;
  sourceSnapshotSha256: string;
  humanReview: {
    reviewedAllSelected: boolean;
    reviewedAt?: string;
    reviewer?: string;
    reviewScope: typeof packshotReviewScope;
    approvedCount: number;
  };
  selected: SelectedItem[];
};

type PublishedProduct = Candidate & {
  sourceSnapshotSha256: string;
  sourceFullImageUrl: string;
  canonicalImageUrl: string;
  sourceImageSha256: string;
  imageSha256: string;
  imageMimeType: "image/webp";
  imageWidth: 1000;
  imageHeight: 1000;
  imageByteSize: number;
  imageHasAlpha: true;
  imageTreatment: "source-faithful-background-extraction";
  imageReviewStatus: "human-approved";
  imageReviewScope: typeof packshotReviewScope;
  imageReviewedAt: string;
  imageReviewer: string;
  imageProcessingModel: string;
  imageProcessingVersion: string;
  imageProcessingProvider: string;
  candidateSha256: string;
  packshotReleaseSha256: string;
};

type Upload = {
  barcode: string;
  imageSha256: string;
  canonicalImageUrl: string;
  imageByteSize: number;
};

type Progress = {
  schemaVersion: 2;
  releaseSha256: string;
  uploads: Upload[];
  failures: Array<{ barcode: string; reason: string }>;
};

const root = process.cwd();
const selectionPath = path.resolve(
  root,
  ".cache/catalogue-packshots/selection/selected-packshots.json",
);
const candidatePath = path.resolve(
  root,
  ".cache/openbeautyfacts-candidates.json",
);
const candidateMetaPath = path.resolve(
  root,
  ".cache/openbeautyfacts-candidate-meta.json",
);
const auditPath = path.resolve(
  root,
  ".cache/catalogue-packshots/packshot-audit.json",
);
const progressPath = path.resolve(
  root,
  ".cache/catalogue-packshot-publish-progress.json",
);
const outputPath = path.resolve(root, "data/external-products.json");
const outputMetaPath = path.resolve(root, "data/external-products-meta.json");
const target = 977;
const validateOnly = process.argv.includes("--validate-only");
const hashPattern = /^[0-9a-f]{64}$/;

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validReviewDate(value: string | undefined) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
}

function selectionDigest(selected: SelectedItem[]) {
  return sha256(
    selected
      .map((item) => `${item.candidate.barcode}:${item.audit.output_sha256}`)
      .join("\n"),
  );
}

function releaseDigest(selection: Selection) {
  const lines = [
    "schema:2",
    `target:${selection.target}`,
    `audit-schema:${selection.auditSchemaVersion}`,
    `candidate-manifest:${selection.candidateManifestSha256}`,
    `candidate-metadata:${selection.candidateMetadataSha256}`,
    `source-snapshot:${selection.sourceSnapshotSha256}`,
    `audit-manifest:${selection.auditManifestSha256}`,
  ];
  for (const item of selection.selected) {
    const audit = item.audit;
    lines.push(
      [
        item.candidate.barcode,
        item.candidateSha256,
        audit.source_sha256,
        item.reviewSourceSha256,
        audit.output_sha256,
        audit.status,
        audit.processing_model,
        audit.processing_version,
        audit.processing_provider ?? "CPUExecutionProvider",
        audit.processing_model_sha256 ?? "legacy-unrecorded",
        item.pipelineFingerprint,
      ].join("\t"),
    );
  }
  return sha256(lines.join("\n"));
}

function approvedPath(item: SelectedItem) {
  const localPath = path.resolve(root, item.audit.output_path);
  const approvedRoot = path.resolve(root, ".cache/catalogue-packshots/images");
  invariant(
    localPath.startsWith(`${approvedRoot}${path.sep}`),
    `${item.candidate.barcode}: packshot path is outside the approved cache`,
  );
  return localPath;
}

function reviewSourcePath(item: SelectedItem) {
  const localPath = path.resolve(root, item.audit.source_cache_path);
  const approvedRoot = path.resolve(root, ".cache/catalogue-packshots/sources");
  invariant(
    localPath.startsWith(`${approvedRoot}${path.sep}`),
    `${item.candidate.barcode}: review source path is outside the approved cache`,
  );
  return localPath;
}

async function validateLocalPackshot(item: SelectedItem) {
  const { candidate, audit } = item;
  const [imageBytes, sourcePreviewBytes] = await Promise.all([
    readFile(approvedPath(item)),
    readFile(reviewSourcePath(item)),
  ]);
  invariant(
    sha256(sourcePreviewBytes) === item.reviewSourceSha256,
    `${candidate.barcode}: reviewed source preview changed`,
  );
  invariant(
    sha256(imageBytes) === audit.output_sha256 &&
      imageBytes.length === audit.output_bytes,
    `${candidate.barcode}: packshot bytes no longer match the reviewed audit`,
  );
  const [metadata, statistics] = await Promise.all([
    sharp(imageBytes).metadata(),
    sharp(imageBytes).ensureAlpha().stats(),
  ]);
  invariant(
    metadata.format === "webp" &&
      metadata.width === 1000 &&
      metadata.height === 1000 &&
      metadata.hasAlpha,
    `${candidate.barcode}: packshot must be a transparent 1000 × 1000 WebP`,
  );
  const alpha = statistics.channels[3];
  invariant(
    alpha && alpha.min === 0 && alpha.max === 255,
    `${candidate.barcode}: packshot must contain both transparent and opaque pixels`,
  );
  return imageBytes;
}

async function assertSelection(selection: Selection) {
  invariant(
    selection.schemaVersion === 2,
    "Only an identity-bound schema-v2 packshot release can be published.",
  );
  invariant(
    selection.target === target && selection.selected.length === target,
    `Packshot selection must contain exactly ${target} records.`,
  );
  invariant(
    hashPattern.test(selection.releaseSha256),
    "Release hash is invalid.",
  );
  invariant(
    hashPattern.test(selection.selectionSha256),
    "Selection hash is invalid.",
  );
  invariant(
    selection.humanReview.reviewedAllSelected,
    "Every selected identity, source, and cutout must be visually reviewed before publication.",
  );
  invariant(
    selection.humanReview.reviewScope === packshotReviewScope,
    "Human review scope is incomplete.",
  );
  invariant(
    selection.humanReview.approvedCount === target,
    `Human approval must name all ${target} selected records.`,
  );
  invariant(
    validReviewDate(selection.humanReview.reviewedAt),
    "Human review timestamp is missing, invalid, or in the future.",
  );
  invariant(
    (selection.humanReview.reviewer?.trim().length ?? 0) >= 2,
    "Human reviewer identity is missing.",
  );

  const [candidateBytes, candidateMetaBytes, auditBytes] = await Promise.all([
    readFile(candidatePath),
    readFile(candidateMetaPath),
    readFile(auditPath),
  ]);
  invariant(
    sha256(candidateBytes) === selection.candidateManifestSha256,
    "Candidate manifest changed after review.",
  );
  invariant(
    sha256(candidateMetaBytes) === selection.candidateMetadataSha256,
    "Candidate metadata changed after review.",
  );
  invariant(
    sha256(auditBytes) === selection.auditManifestSha256,
    "Preparation audit changed after review.",
  );
  const candidates = JSON.parse(candidateBytes.toString("utf8")) as Candidate[];
  const candidateMeta = JSON.parse(candidateMetaBytes.toString("utf8")) as {
    candidateCount?: number;
    requestedPublishedCount?: number;
    sourceSnapshotSha256?: string;
    candidateManifestSha256?: string;
  };
  invariant(
    candidateMeta.candidateCount === candidates.length,
    "Candidate metadata count is stale.",
  );
  invariant(
    candidateMeta.requestedPublishedCount === target,
    "Candidate metadata target is stale.",
  );
  invariant(
    candidateMeta.sourceSnapshotSha256 === selection.sourceSnapshotSha256,
    "Source snapshot changed after review.",
  );
  invariant(
    !candidateMeta.candidateManifestSha256 ||
      candidateMeta.candidateManifestSha256 ===
        selection.candidateManifestSha256,
    "Candidate metadata is bound to a different candidate manifest.",
  );
  const byBarcode = new Map(
    candidates.map((candidate) => [candidate.barcode, candidate]),
  );
  invariant(
    byBarcode.size === candidates.length,
    "Candidate manifest contains duplicate barcodes.",
  );

  const ids = new Set<string>();
  for (const item of selection.selected) {
    const { candidate, audit } = item;
    invariant(
      candidate.barcode === audit.barcode,
      `${candidate.barcode}: audit barcode mismatch`,
    );
    invariant(
      !ids.has(candidate.barcode),
      `${candidate.barcode}: duplicate selection`,
    );
    ids.add(candidate.barcode);
    invariant(
      ["ready", "review"].includes(audit.status),
      `${candidate.barcode}: quarantined audit cannot be published`,
    );
    invariant(
      audit.brand === candidate.brand && audit.name === candidate.name,
      `${candidate.barcode}: audit identity mismatch`,
    );
    invariant(
      audit.source_url === candidate.sourceImageUrl,
      `${candidate.barcode}: audit source mismatch`,
    );
    invariant(
      candidateSha256(candidate) === item.candidateSha256,
      `${candidate.barcode}: embedded candidate hash mismatch`,
    );
    const currentCandidate = byBarcode.get(candidate.barcode);
    invariant(
      currentCandidate &&
        candidateSha256(currentCandidate) === item.candidateSha256,
      `${candidate.barcode}: candidate changed after review`,
    );
    invariant(
      hashPattern.test(audit.source_sha256),
      `${candidate.barcode}: source image hash is invalid`,
    );
    invariant(
      hashPattern.test(audit.output_sha256),
      `${candidate.barcode}: output image hash is invalid`,
    );
    invariant(
      hashPattern.test(item.reviewSourceSha256),
      `${candidate.barcode}: review source hash is invalid`,
    );
    invariant(
      hashPattern.test(item.pipelineFingerprint),
      `${candidate.barcode}: pipeline fingerprint is invalid`,
    );
    invariant(
      new URL(audit.full_source_url).hostname === "images.openbeautyfacts.org",
      `${candidate.barcode}: full source host is invalid`,
    );
  }
  invariant(
    selectionDigest(selection.selected) === selection.selectionSha256,
    "Selection hash does not match selected packshots.",
  );
  invariant(
    releaseDigest(selection) === selection.releaseSha256,
    "Release hash does not match identity/source/audit provenance.",
  );
}

function uploadPath(item: SelectedItem) {
  return `catalogue/open-beauty-facts/${item.candidate.barcode}/packshot-${item.audit.output_sha256.slice(0, 12)}.webp`;
}

function validateUpload(item: SelectedItem, upload: Upload) {
  invariant(
    upload.barcode === item.candidate.barcode,
    `${upload.barcode}: upload membership mismatch`,
  );
  invariant(
    upload.imageSha256 === item.audit.output_sha256,
    `${upload.barcode}: upload image hash mismatch`,
  );
  invariant(
    upload.imageByteSize === item.audit.output_bytes,
    `${upload.barcode}: upload byte size mismatch`,
  );
  const url = new URL(upload.canonicalImageUrl);
  invariant(
    url.protocol === "https:" && url.pathname === `/${uploadPath(item)}`,
    `${upload.barcode}: upload URL path mismatch`,
  );
}

async function loadProgress(selection: Selection): Promise<Progress> {
  try {
    const progress = JSON.parse(
      await readFile(progressPath, "utf8"),
    ) as Progress;
    if (
      progress.schemaVersion !== 2 ||
      progress.releaseSha256 !== selection.releaseSha256
    ) {
      return {
        schemaVersion: 2,
        releaseSha256: selection.releaseSha256,
        uploads: [],
        failures: [],
      };
    }
    const selected = new Map(
      selection.selected.map((item) => [item.candidate.barcode, item]),
    );
    const seen = new Set<string>();
    for (const upload of progress.uploads) {
      invariant(
        !seen.has(upload.barcode),
        `${upload.barcode}: duplicate upload progress`,
      );
      seen.add(upload.barcode);
      const item = selected.get(upload.barcode);
      invariant(
        item,
        `${upload.barcode}: stale upload is outside the current release`,
      );
      validateUpload(item, upload);
    }
    return progress;
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      error instanceof SyntaxError
    ) {
      return {
        schemaVersion: 2,
        releaseSha256: selection.releaseSha256,
        uploads: [],
        failures: [],
      };
    }
    throw error;
  }
}

async function saveProgress(progress: Progress) {
  await mkdir(path.dirname(progressPath), { recursive: true });
  const temporary = `${progressPath}.partial`;
  await writeFile(temporary, `${JSON.stringify(progress, null, 2)}\n`);
  await rename(temporary, progressPath);
}

async function publishOne(item: SelectedItem): Promise<Upload> {
  const imageBytes = await validateLocalPackshot(item);
  const pathname = uploadPath(item);
  const blob = await put(pathname, imageBytes, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31_536_000,
  });
  const upload = {
    barcode: item.candidate.barcode,
    imageSha256: item.audit.output_sha256,
    canonicalImageUrl: blob.url,
    imageByteSize: imageBytes.length,
  };
  validateUpload(item, upload);
  return upload;
}

function publishedProduct(
  selection: Selection,
  item: SelectedItem,
  upload: Upload,
): PublishedProduct {
  const reviewedAt = selection.humanReview.reviewedAt!;
  const reviewer = selection.humanReview.reviewer!;
  return {
    ...item.candidate,
    sourceSnapshotSha256: selection.sourceSnapshotSha256,
    sourceFullImageUrl: item.audit.full_source_url,
    canonicalImageUrl: upload.canonicalImageUrl,
    sourceImageSha256: item.audit.source_sha256,
    imageSha256: item.audit.output_sha256,
    imageMimeType: "image/webp",
    imageWidth: 1000,
    imageHeight: 1000,
    imageByteSize: upload.imageByteSize,
    imageHasAlpha: true,
    imageTreatment: "source-faithful-background-extraction",
    imageReviewStatus: "human-approved",
    imageReviewScope: packshotReviewScope,
    imageReviewedAt: reviewedAt,
    imageReviewer: reviewer,
    imageProcessingModel: item.audit.processing_model,
    imageProcessingVersion: item.audit.processing_version,
    imageProcessingProvider:
      item.audit.processing_provider ?? "CPUExecutionProvider",
    candidateSha256: item.candidateSha256,
    packshotReleaseSha256: selection.releaseSha256,
  };
}

async function atomicJson(pathname: string, value: unknown) {
  const temporary = `${pathname}.partial`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, pathname);
}

async function main() {
  if (!validateOnly) {
    throw new Error(
      "Deprecated: raw background-extracted packshots are private production inputs and cannot be published. Approve a magazine-ready final photograph or identity-verified styled composite instead.",
    );
  }
  const selection = JSON.parse(
    await readFile(selectionPath, "utf8"),
  ) as Selection;
  await assertSelection(selection);
  const concurrency = 8;
  for (
    let offset = 0;
    offset < selection.selected.length;
    offset += concurrency
  ) {
    const batch = selection.selected.slice(offset, offset + concurrency);
    await Promise.all(batch.map(validateLocalPackshot));
  }
  if (validateOnly) {
    console.log(
      `Validated ${target} identity-bound cutouts as private production inputs; no upload performed.`,
    );
    return;
  }
  invariant(
    process.env.BLOB_READ_WRITE_TOKEN,
    "BLOB_READ_WRITE_TOKEN is required.",
  );
  const candidateMeta = JSON.parse(
    await readFile(candidateMetaPath, "utf8"),
  ) as Record<string, unknown>;
  const progress = await loadProgress(selection);
  const completed = new Set(progress.uploads.map((upload) => upload.barcode));
  const pending = selection.selected.filter(
    (item) => !completed.has(item.candidate.barcode),
  );
  const uploadConcurrency = 6;

  for (let offset = 0; offset < pending.length; offset += uploadConcurrency) {
    const batch = pending.slice(offset, offset + uploadConcurrency);
    const results = await Promise.allSettled(batch.map(publishOne));
    results.forEach((result, index) => {
      const barcode = batch[index]!.candidate.barcode;
      progress.failures = progress.failures.filter(
        (failure) => failure.barcode !== barcode,
      );
      if (result.status === "fulfilled") {
        progress.uploads.push(result.value);
        console.log(`✓ ${progress.uploads.length}/${target} ${barcode}`);
      } else {
        const reason = failureMessage(result.reason);
        progress.failures.push({ barcode, reason });
        console.error(`✗ ${barcode} ${reason}`);
      }
    });
    await saveProgress(progress);
  }
  invariant(
    progress.uploads.length === target,
    `Published ${progress.uploads.length}/${target} packshots; rerun to retry ${progress.failures.length} failures.`,
  );
  const uploads = new Map(
    progress.uploads.map((upload) => [upload.barcode, upload]),
  );
  invariant(
    uploads.size === target,
    "Upload progress does not contain exactly one asset per selected product.",
  );
  const products = selection.selected
    .map((item) =>
      publishedProduct(selection, item, uploads.get(item.candidate.barcode)!),
    )
    .sort(
      (left, right) =>
        right.qualityScore - left.qualityScore ||
        left.barcode.localeCompare(right.barcode),
    );
  const categories = [
    "Face care",
    "Hair & scalp",
    "Body care",
    "Makeup",
    "Fragrance",
    "Personal care",
  ] as const;
  const categoryCounts = Object.fromEntries(
    categories.map((category) => [
      category,
      products.filter((product) => product.category === category).length,
    ]),
  );
  const metadata = {
    ...candidateMeta,
    sourceSnapshotSha256: selection.sourceSnapshotSha256,
    requestedPublishedCount: target,
    reviewedCount: 23,
    communitySourcedCount: 0,
    publicCatalogueCount: 23,
    mirroredImageCount: target,
    mirrorFailureCount: 0,
    sourcePhotoValidatedCount: products.filter(
      (product) => product.sourcePhotoValidated,
    ).length,
    sourceIngredientsCompleteCount: products.filter(
      (product) => product.sourceIngredientsComplete,
    ).length,
    categoryCounts,
    packshotReleaseSha256: selection.releaseSha256,
    packshotSelectionSha256: selection.selectionSha256,
    packshotCandidateManifestSha256: selection.candidateManifestSha256,
    packshotCandidateMetadataSha256: selection.candidateMetadataSha256,
    packshotAuditManifestSha256: selection.auditManifestSha256,
    packshotReviewStatus: "human-approved",
    packshotReviewScope,
    packshotReviewedAt: selection.humanReview.reviewedAt!,
    packshotReviewer: selection.humanReview.reviewer!,
    packshotProcessingModels: [
      ...new Set(products.map((product) => product.imageProcessingModel)),
    ].sort(),
    packshotProcessingVersions: [
      ...new Set(products.map((product) => product.imageProcessingVersion)),
    ].sort(),
    packshotProcessingProviders: [
      ...new Set(products.map((product) => product.imageProcessingProvider)),
    ].sort(),
    generatedAt: new Date().toISOString(),
  } satisfies PackshotReleaseMetadata & Record<string, unknown>;
  assertPublishedPackshotRelease(products, metadata, target);
  await atomicJson(outputPath, products);
  await atomicJson(outputMetaPath, metadata);
  console.log(
    `Wrote ${target} private research cutouts. No catalogue records were published.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
