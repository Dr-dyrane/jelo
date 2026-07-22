import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type ReviewedAsset = {
  blobUrl: string;
  sourceUrl: string;
};

type ExternalProduct = {
  barcode: string;
  brand: string;
  name: string;
  canonicalImageUrl: string;
  sourceImageUrl: string;
};

type AuditTarget = {
  id: string;
  label: string;
  kind: 'reviewed' | 'community';
  imageUrl: string;
  sourceUrl: string;
};

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type CatalogueImageAudit = {
  id: string;
  label: string;
  kind: AuditTarget['kind'];
  imageUrl: string;
  sourceUrl: string;
  status: 'display' | 'review' | 'quarantine';
  score: number;
  reasons: string[];
  width: number;
  height: number;
  format: string;
  hasUsefulAlpha: boolean;
  transparentFraction: number;
  background: 'transparent' | 'studio' | 'scene';
  borderMeanDelta: number;
  borderP90Delta: number;
  subjectBounds: Bounds | null;
  subjectWidthFraction: number;
  subjectHeightFraction: number;
  subjectAreaFraction: number;
  centerOffsetX: number;
  centerOffsetY: number;
  edgeContactFraction: number;
  cachedPath: string;
};

const projectRoot = process.cwd();
const cacheRoot = path.resolve(projectRoot, '.cache/catalogue-image-audit');
const rawRoot = path.join(cacheRoot, 'raw');
const sheetRoot = path.join(cacheRoot, 'sheets');
const outputPath = path.join(cacheRoot, 'catalogue-image-audit.json');
const reviewedManifestPath = path.resolve(projectRoot, 'data/product-assets.json');
const externalManifestPath = path.resolve(projectRoot, 'data/external-products.json');

const maxDownloadBytes = 12 * 1024 * 1024;
const analysisSize = 420;
const sheetColumns = 6;
const sheetRows = 8;
const sheetTileWidth = 240;
const sheetTileHeight = 284;

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeId(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function median(values: number[]) {
  return percentile(values, 0.5);
}

function colorDistance(red: number, green: number, blue: number, reference: [number, number, number]) {
  return Math.sqrt(
    (red - reference[0]) ** 2
      + (green - reference[1]) ** 2
      + (blue - reference[2]) ** 2,
  );
}

async function fetchImage(target: AuditTarget) {
  const response = await fetch(target.imageUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.1',
      'User-Agent': 'JeloCareImageAudit/1.0 (hello@jelocare.com)',
    },
  });
  if (!response.ok) throw new Error(`image returned ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxDownloadBytes) throw new Error('image exceeds 12 MB');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maxDownloadBytes) throw new Error('image is empty or exceeds 12 MB');
  return bytes;
}

function collectBorderSamples(raw: Buffer, width: number, height: number) {
  const channels = 4;
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.025));
  const samples: Array<[number, number, number, number]> = [];
  const push = (x: number, y: number) => {
    const offset = (y * width + x) * channels;
    samples.push([raw[offset] ?? 0, raw[offset + 1] ?? 0, raw[offset + 2] ?? 0, raw[offset + 3] ?? 255]);
  };

  for (let x = 0; x < width; x += 2) {
    for (let y = 0; y < inset; y += 1) push(x, y);
    for (let y = Math.max(0, height - inset); y < height; y += 1) push(x, y);
  }
  for (let y = inset; y < height - inset; y += 2) {
    for (let x = 0; x < inset; x += 1) push(x, y);
    for (let x = Math.max(0, width - inset); x < width; x += 1) push(x, y);
  }
  return samples;
}

function calculateBounds(mask: Uint8Array, width: number, height: number): Bounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function largestCentralComponent(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const result = new Uint8Array(mask.length);
  const centerX = width / 2;
  const centerY = height / 2;
  let best: number[] = [];
  let bestRank = -Infinity;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    const component: number[] = [];
    visited[start] = 1;
    let cursor = 0;
    let sumX = 0;
    let sumY = 0;

    while (cursor < queue.length) {
      const current = queue[cursor++] ?? 0;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      sumX += x;
      sumY += y;

      const neighbours = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || visited[neighbour] || !mask[neighbour]) continue;
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }

    const componentX = sumX / component.length;
    const componentY = sumY / component.length;
    const distance = Math.hypot((componentX - centerX) / width, (componentY - centerY) / height);
    const rank = component.length * Math.max(0.35, 1 - distance * 1.7);
    if (rank > bestRank) {
      bestRank = rank;
      best = component;
    }
  }

  for (const index of best) result[index] = 1;
  return result;
}

async function auditImage(target: AuditTarget): Promise<CatalogueImageAudit> {
  const bytes = await fetchImage(target);
  const decoded = sharp(bytes, { animated: false }).rotate();
  const metadata = await decoded.metadata();
  if (!metadata.width || !metadata.height) throw new Error('image dimensions are unavailable');

  const cachedFilename = `${target.kind}-${safeId(target.id)}.webp`;
  const cachedPath = path.join(rawRoot, cachedFilename);
  await decoded.clone().webp({ quality: 88, effort: 4 }).toFile(cachedPath);

  const analysis = await decoded
    .clone()
    .resize({ width: analysisSize, height: analysisSize, fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = analysis.info;
  const raw = analysis.data;
  const border = collectBorderSamples(raw, width, height);
  const borderReference: [number, number, number] = [
    median(border.map(sample => sample[0])),
    median(border.map(sample => sample[1])),
    median(border.map(sample => sample[2])),
  ];
  const borderDeltas = border.map(sample => colorDistance(sample[0], sample[1], sample[2], borderReference));
  const borderMeanDelta = borderDeltas.reduce((sum, value) => sum + value, 0) / Math.max(1, borderDeltas.length);
  const borderP90Delta = percentile(borderDeltas, 0.9);

  let transparentPixels = 0;
  let partiallyTransparentPixels = 0;
  for (let index = 3; index < raw.length; index += 4) {
    const alpha = raw[index] ?? 255;
    if (alpha < 16) transparentPixels += 1;
    if (alpha < 245) partiallyTransparentPixels += 1;
  }
  const pixelCount = width * height;
  const transparentFraction = transparentPixels / pixelCount;
  const hasUsefulAlpha = partiallyTransparentPixels / pixelCount > 0.025;
  const studioBorder = borderP90Delta <= 32 && borderMeanDelta <= 17;
  const background: CatalogueImageAudit['background'] = hasUsefulAlpha
    ? 'transparent'
    : studioBorder
      ? 'studio'
      : 'scene';

  const preliminaryMask = new Uint8Array(pixelCount);
  const colorThreshold = Math.max(20, Math.min(48, borderP90Delta * 1.35 + 12));
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const alpha = raw[offset + 3] ?? 255;
    if (hasUsefulAlpha) {
      preliminaryMask[pixel] = alpha >= 24 ? 1 : 0;
      continue;
    }
    if (studioBorder) {
      const distance = colorDistance(raw[offset] ?? 0, raw[offset + 1] ?? 0, raw[offset + 2] ?? 0, borderReference);
      preliminaryMask[pixel] = distance > colorThreshold ? 1 : 0;
      continue;
    }
    preliminaryMask[pixel] = 1;
  }

  const foregroundMask = background === 'scene'
    ? preliminaryMask
    : largestCentralComponent(preliminaryMask, width, height);
  const subjectBounds = background === 'scene' ? null : calculateBounds(foregroundMask, width, height);
  const subjectWidthFraction = subjectBounds ? subjectBounds.width / width : 1;
  const subjectHeightFraction = subjectBounds ? subjectBounds.height / height : 1;
  const subjectAreaFraction = subjectBounds ? subjectWidthFraction * subjectHeightFraction : 1;
  const centerOffsetX = subjectBounds
    ? Math.abs((subjectBounds.left + subjectBounds.right) / 2 - width / 2) / width
    : 0.5;
  const centerOffsetY = subjectBounds
    ? Math.abs((subjectBounds.top + subjectBounds.bottom) / 2 - height / 2) / height
    : 0.5;

  const edgeBand = Math.max(1, Math.round(Math.min(width, height) * 0.012));
  let edgePixels = 0;
  let foregroundEdgePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= edgeBand && x < width - edgeBand && y >= edgeBand && y < height - edgeBand) continue;
      edgePixels += 1;
      if (foregroundMask[y * width + x]) foregroundEdgePixels += 1;
    }
  }
  const edgeContactFraction = foregroundEdgePixels / Math.max(1, edgePixels);

  const reasons: string[] = [];
  let score = 100;
  const longestSide = Math.max(metadata.width, metadata.height);
  const shortestSide = Math.min(metadata.width, metadata.height);

  if (background === 'transparent') reasons.push('transparent-background');
  if (background === 'studio') reasons.push('clean-studio-background');
  if (background === 'scene') {
    reasons.push('background-needs-review');
    score -= 36;
  }
  if (longestSide < 360 || shortestSide < 100) {
    reasons.push('limited-resolution');
    score -= 24;
  } else if (longestSide < 500) {
    reasons.push('moderate-resolution');
    score -= 8;
  }
  if (!subjectBounds) {
    reasons.push('subject-bounds-uncertain');
    score -= 18;
  } else {
    if (edgeContactFraction > 0.12) {
      reasons.push('likely-clipped');
      score -= 42;
    } else if (edgeContactFraction > 0.025) {
      reasons.push('tight-edge');
      score -= 18;
    }
    if (subjectHeightFraction < 0.42 || subjectAreaFraction < 0.06) {
      reasons.push('product-too-small');
      score -= 26;
    }
    if (subjectHeightFraction > 0.975 || subjectWidthFraction > 0.975) {
      reasons.push('insufficient-padding');
      score -= 22;
    }
    if (centerOffsetX > 0.15 || centerOffsetY > 0.16) {
      reasons.push('off-centre');
      score -= 16;
    }
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const status: CatalogueImageAudit['status'] = score >= 78
    ? 'display'
    : score >= 50
      ? 'review'
      : 'quarantine';

  return {
    id: target.id,
    label: target.label,
    kind: target.kind,
    imageUrl: target.imageUrl,
    sourceUrl: target.sourceUrl,
    status,
    score,
    reasons,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format ?? 'unknown',
    hasUsefulAlpha,
    transparentFraction,
    background,
    borderMeanDelta,
    borderP90Delta,
    subjectBounds,
    subjectWidthFraction,
    subjectHeightFraction,
    subjectAreaFraction,
    centerOffsetX,
    centerOffsetY,
    edgeContactFraction,
    cachedPath: path.relative(projectRoot, cachedPath),
  };
}

async function makeSheet(audits: CatalogueImageAudit[], sheetNumber: number, kind: AuditTarget['kind']) {
  const sheetWidth = sheetColumns * sheetTileWidth;
  const sheetHeight = sheetRows * sheetTileHeight;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let index = 0; index < audits.length; index += 1) {
    const audit = audits[index];
    if (!audit) continue;
    const column = index % sheetColumns;
    const row = Math.floor(index / sheetColumns);
    const left = column * sheetTileWidth;
    const top = row * sheetTileHeight;
    const image = await sharp(path.resolve(projectRoot, audit.cachedPath))
      .resize({ width: 204, height: 204, fit: 'contain', background: '#fffaf7' })
      .flatten({ background: '#fffaf7' })
      .png()
      .toBuffer();
    const statusColor = audit.status === 'display' ? '#2f7658' : audit.status === 'review' ? '#aa6d25' : '#ad3e4a';
    const compactReasons = audit.reasons.filter(reason => !reason.includes('background')).slice(-2).join(' · ');
    const textSvg = Buffer.from(`
      <svg width="${sheetTileWidth}" height="${sheetTileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${sheetTileWidth}" height="${sheetTileHeight}" fill="#fffaf7"/>
        <rect x="12" y="12" width="216" height="216" rx="18" fill="#f8e9e5"/>
        <text x="14" y="246" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#30211f">${xml(audit.label.slice(0, 31))}</text>
        <text x="14" y="263" font-family="Arial, sans-serif" font-size="10" fill="${statusColor}">${audit.status.toUpperCase()} · ${audit.score} · ${audit.width}×${audit.height}</text>
        <text x="14" y="277" font-family="Arial, sans-serif" font-size="9" fill="#765f59">${xml(compactReasons.slice(0, 43))}</text>
      </svg>
    `);
    composites.push({ input: textSvg, left, top });
    composites.push({ input: image, left: left + 18, top: top + 18 });
  }

  const filename = `${kind}-${String(sheetNumber + 1).padStart(2, '0')}.jpg`;
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: '#fffaf7',
    },
  }).composite(composites).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toFile(path.join(sheetRoot, filename));
}

async function loadTargets() {
  const reviewed = JSON.parse(await readFile(reviewedManifestPath, 'utf8')) as Record<string, ReviewedAsset>;
  const external = JSON.parse(await readFile(externalManifestPath, 'utf8')) as ExternalProduct[];
  const reviewedTargets: AuditTarget[] = Object.entries(reviewed).map(([slug, asset]) => ({
    id: slug,
    label: slug,
    kind: 'reviewed',
    imageUrl: asset.blobUrl,
    sourceUrl: asset.sourceUrl,
  }));
  const externalTargets: AuditTarget[] = external.map(product => ({
    id: product.barcode,
    label: `${product.brand} · ${product.name}`,
    kind: 'community',
    imageUrl: product.canonicalImageUrl,
    sourceUrl: product.sourceImageUrl,
  }));
  return [...reviewedTargets, ...externalTargets];
}

async function main() {
  await mkdir(rawRoot, { recursive: true });
  await mkdir(sheetRoot, { recursive: true });
  const targets = await loadTargets();
  const audits: CatalogueImageAudit[] = [];
  const failures: Array<{ id: string; reason: string }> = [];
  const concurrency = 10;

  for (let offset = 0; offset < targets.length; offset += concurrency) {
    const batch = targets.slice(offset, offset + concurrency);
    const results = await Promise.allSettled(batch.map(auditImage));
    results.forEach((result, index) => {
      const target = batch[index];
      if (!target) return;
      if (result.status === 'fulfilled') {
        audits.push(result.value);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push({ id: target.id, reason });
      }
    });
    console.log(`Audited ${Math.min(offset + batch.length, targets.length)}/${targets.length}`);
  }

  audits.sort((left, right) => left.kind.localeCompare(right.kind) || right.score - left.score || left.id.localeCompare(right.id));
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: {
      displayScore: 78,
      reviewScore: 50,
      note: 'Automated presentation audit only. Identity, licensing, and clinical review are separate trust dimensions.',
    },
    summary: {
      targetCount: targets.length,
      auditedCount: audits.length,
      failureCount: failures.length,
      displayCount: audits.filter(audit => audit.status === 'display').length,
      reviewCount: audits.filter(audit => audit.status === 'review').length,
      quarantineCount: audits.filter(audit => audit.status === 'quarantine').length,
      transparentCount: audits.filter(audit => audit.background === 'transparent').length,
      studioCount: audits.filter(audit => audit.background === 'studio').length,
      sceneCount: audits.filter(audit => audit.background === 'scene').length,
    },
    failures,
    audits,
  };
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  for (const kind of ['reviewed', 'community'] as const) {
    const kindAudits = audits.filter(audit => audit.kind === kind);
    const pageSize = sheetColumns * sheetRows;
    for (let offset = 0; offset < kindAudits.length; offset += pageSize) {
      await makeSheet(kindAudits.slice(offset, offset + pageSize), offset / pageSize, kind);
    }
  }

  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`Audit: ${path.relative(projectRoot, outputPath)}`);
  console.log(`Contact sheets: ${path.relative(projectRoot, sheetRoot)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
