import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  assertCataloguePublicationImageLocation,
  cataloguePublicationImageMaxBytes,
  cataloguePublicationImageMaxSide,
  cataloguePublicationImageMinSide,
  cataloguePublicationSurfaceRgb,
  type CataloguePublicationImageMimeType,
} from './publication-image-policy';

export type CataloguePublicationImageExpectation = {
  candidateId: string;
  url: string;
  sha256: string;
  mimeType: CataloguePublicationImageMimeType;
  byteSize: number;
  width: number;
  height: number;
};

export type CataloguePublicationImageMetrics = {
  zeroAlphaFraction: number;
  transparentFraction: number;
  partiallyTransparentFraction: number;
  opaqueFraction: number;
  subjectWidthFraction: number;
  subjectHeightFraction: number;
  subjectAreaFraction: number;
  centerOffsetX: number;
  centerOffsetY: number;
  edgeContactFraction: number;
  surfaceBackgroundMeanDelta: number;
  surfaceBackgroundP90Delta: number;
  largestComponentAreaFraction: number;
  largestComponentFillFraction: number;
  lightNeutralPlaneAreaFraction: number;
  lightNeutralPlaneBoundsFraction: number;
  lightNeutralPlaneFillFraction: number;
  opaquePlaneAreaFraction: number;
  opaquePlaneBoundsFraction: number;
  opaquePlaneFillFraction: number;
  opaquePlanePerimeterFraction: number;
  partialAlphaPlaneAreaFraction: number;
  partialAlphaPlaneBoundsFraction: number;
  partialAlphaPlaneFillFraction: number;
  partialAlphaPlanePerimeterFraction: number;
};

export type CataloguePublicationImageVerification = CataloguePublicationImageExpectation & {
  decodedFormat: 'png' | 'webp';
  metrics: CataloguePublicationImageMetrics;
};

type RemoteCataloguePublicationImageVerificationOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  notFoundRetryDelaysMs?: readonly number[];
};

type Bounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const hashPattern = /^[0-9a-f]{64}$/;
const analysisSize = 384;
function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  values.sort((left, right) => left - right);
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] ?? 0;
}

function significantComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const components: number[][] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    const component: number[] = [];
    visited[start] = 1;
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++] ?? 0;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
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
    components.push(component);
  }
  components.sort((left, right) => right.length - left.length);
  const largest = components[0] ?? [];
  const threshold = Math.max(8, Math.ceil(mask.length * 0.00025), Math.ceil(largest.length * 0.005));
  const foreground = new Uint8Array(mask.length);
  for (const component of components) {
    if (component.length < threshold) continue;
    for (const index of component) foreground[index] = 1;
  }
  const largestMask = new Uint8Array(mask.length);
  for (const index of largest) largestMask[index] = 1;
  return { foreground, largestMask, largestPixelCount: largest.length };
}

function boundsFor(mask: Uint8Array, width: number, height: number): Bounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  return right < left || bottom < top
    ? null
    : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

type ComponentTopology = {
  areaFraction: number;
  boundsFraction: number;
  fillFraction: number;
  widthFraction: number;
  heightFraction: number;
  balancedExtentFraction: number;
  centerOffsetX: number;
  centerOffsetY: number;
  perimeterFraction: number;
};

function largestComponentTopology(
  mask: Uint8Array,
  width: number,
  height: number,
): ComponentTopology {
  const components = significantComponents(mask, width, height);
  const bounds = boundsFor(components.largestMask, width, height);
  if (!bounds) {
    return {
      areaFraction: 0,
      boundsFraction: 0,
      fillFraction: 0,
      widthFraction: 0,
      heightFraction: 0,
      balancedExtentFraction: 0,
      centerOffsetX: 0,
      centerOffsetY: 0,
      perimeterFraction: 0,
    };
  }

  let perimeterPixels = 0;
  let componentPerimeterPixels = 0;
  const countPerimeterPixel = (x: number, y: number) => {
    perimeterPixels += 1;
    if (components.largestMask[y * width + x]) componentPerimeterPixels += 1;
  };
  for (let x = bounds.left; x <= bounds.right; x += 1) {
    countPerimeterPixel(x, bounds.top);
    if (bounds.bottom !== bounds.top) countPerimeterPixel(x, bounds.bottom);
  }
  for (let y = bounds.top + 1; y < bounds.bottom; y += 1) {
    countPerimeterPixel(bounds.left, y);
    if (bounds.right !== bounds.left) countPerimeterPixel(bounds.right, y);
  }

  const pixelCount = width * height;
  const widthFraction = bounds.width / width;
  const heightFraction = bounds.height / height;
  return {
    areaFraction: components.largestPixelCount / pixelCount,
    boundsFraction: (bounds.width * bounds.height) / pixelCount,
    fillFraction: components.largestPixelCount / (bounds.width * bounds.height),
    widthFraction,
    heightFraction,
    balancedExtentFraction: Math.min(widthFraction, heightFraction) / Math.max(widthFraction, heightFraction),
    centerOffsetX: Math.abs((bounds.left + bounds.right) / 2 - width / 2) / width,
    centerOffsetY: Math.abs((bounds.top + bounds.bottom) / 2 - height / 2) / height,
    perimeterFraction: componentPerimeterPixels / Math.max(1, perimeterPixels),
  };
}

function isBroadCanvasPlane(topology: ComponentTopology, minimumFillFraction: number) {
  // Canvas remnants are broad on both axes and retain a nearly rectangular outer
  // perimeter; portrait cartons and irregular translucent package silhouettes do not.
  return topology.widthFraction >= 0.64
    && topology.heightFraction >= 0.64
    && topology.balancedExtentFraction >= 0.88
    && topology.fillFraction >= minimumFillFraction
    && topology.perimeterFraction >= 0.9
    && topology.centerOffsetX <= 0.08
    && topology.centerOffsetY <= 0.08;
}

function surfaceBackgroundMetrics(
  raw: Buffer,
  foreground: Uint8Array,
  channels: number,
) {
  let maxMean = 0;
  let maxP90 = 0;
  for (const [backgroundRed, backgroundGreen, backgroundBlue] of cataloguePublicationSurfaceRgb) {
    const deltas: number[] = [];
    for (let pixel = 0; pixel < foreground.length; pixel += 1) {
      if (foreground[pixel]) continue;
      const offset = pixel * channels;
      const alpha = (raw[offset + 3] ?? 255) / 255;
      const red = (raw[offset] ?? 0) * alpha + backgroundRed * (1 - alpha);
      const green = (raw[offset + 1] ?? 0) * alpha + backgroundGreen * (1 - alpha);
      const blue = (raw[offset + 2] ?? 0) * alpha + backgroundBlue * (1 - alpha);
      deltas.push(Math.hypot(red - backgroundRed, green - backgroundGreen, blue - backgroundBlue));
    }
    const mean = deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length);
    maxMean = Math.max(maxMean, mean);
    maxP90 = Math.max(maxP90, percentile(deltas, 0.9));
  }
  return { mean: maxMean, p90: maxP90 };
}

function lightNeutralMask(raw: Buffer, pixelCount: number, channels: number) {
  const mask = new Uint8Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * channels;
    const red = raw[offset] ?? 0;
    const green = raw[offset + 1] ?? 0;
    const blue = raw[offset + 2] ?? 0;
    const alpha = raw[offset + 3] ?? 255;
    if (alpha >= 245 && Math.min(red, green, blue) >= 225 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 18) {
      mask[pixel] = 1;
    }
  }
  return mask;
}

function assertExpectation(expectation: CataloguePublicationImageExpectation) {
  assertCataloguePublicationImageLocation(
    expectation.candidateId,
    expectation.url,
    expectation.mimeType,
    expectation.sha256,
  );
  if (!hashPattern.test(expectation.sha256)) throw new Error(`${expectation.candidateId}: final image hash is invalid.`);
  if (
    !Number.isInteger(expectation.byteSize)
    || expectation.byteSize <= 0
    || expectation.byteSize > cataloguePublicationImageMaxBytes
  ) throw new Error(`${expectation.candidateId}: final image byte size is invalid.`);
  if (
    !Number.isInteger(expectation.width)
    || !Number.isInteger(expectation.height)
    || Math.min(expectation.width, expectation.height) < cataloguePublicationImageMinSide
    || Math.max(expectation.width, expectation.height) > cataloguePublicationImageMaxSide
  ) throw new Error(`${expectation.candidateId}: final image dimensions are outside the publication range.`);
}

export async function verifyCataloguePublicationImageBytes(
  expectation: CataloguePublicationImageExpectation,
  bytes: Buffer,
  responseMimeType: string = expectation.mimeType,
): Promise<CataloguePublicationImageVerification> {
  assertExpectation(expectation);
  if (responseMimeType !== expectation.mimeType) {
    throw new Error(`${expectation.candidateId}: final image response type changed.`);
  }
  if (bytes.length !== expectation.byteSize) {
    throw new Error(`${expectation.candidateId}: final image byte size changed.`);
  }
  if (sha256(bytes) !== expectation.sha256) {
    throw new Error(`${expectation.candidateId}: final image bytes do not match the approved hash.`);
  }

  const image = sharp(bytes, {
    animated: false,
    failOn: 'warning',
    limitInputPixels: cataloguePublicationImageMaxSide * cataloguePublicationImageMaxSide,
    sequentialRead: true,
  });
  const metadata = await image.metadata();
  const decodedFormat = metadata.format === 'png' ? 'png' : metadata.format === 'webp' ? 'webp' : null;
  const expectedFormat = expectation.mimeType === 'image/png' ? 'png' : 'webp';
  if (decodedFormat !== expectedFormat) throw new Error(`${expectation.candidateId}: final image format does not match its MIME type.`);
  if ((metadata.pages ?? 1) !== 1) throw new Error(`${expectation.candidateId}: animated or multi-page images cannot be published.`);
  if (metadata.orientation != null && metadata.orientation !== 1) {
    throw new Error(`${expectation.candidateId}: oriented image metadata must be flattened before publication.`);
  }
  if (metadata.width !== expectation.width || metadata.height !== expectation.height) {
    throw new Error(`${expectation.candidateId}: decoded dimensions do not match the dossier.`);
  }
  if (!metadata.hasAlpha) throw new Error(`${expectation.candidateId}: final packshot has no alpha channel.`);

  const { data: raw, info } = await image
    .clone()
    .resize(analysisSize, analysisSize, { fit: 'fill', kernel: sharp.kernel.nearest })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  let zeroAlpha = 0;
  let transparent = 0;
  let partiallyTransparent = 0;
  let opaque = 0;
  const preliminary = new Uint8Array(pixelCount);
  const opaqueMask = new Uint8Array(pixelCount);
  const partialAlphaMask = new Uint8Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const alpha = raw[pixel * info.channels + 3] ?? 255;
    if (alpha <= 4) zeroAlpha += 1;
    if (alpha <= 16) transparent += 1;
    if (alpha > 0 && alpha < 245) partiallyTransparent += 1;
    if (alpha > 16 && alpha < 245) partialAlphaMask[pixel] = 1;
    if (alpha >= 245) {
      opaque += 1;
      opaqueMask[pixel] = 1;
    }
    if (alpha >= 24) preliminary[pixel] = 1;
  }

  const components = significantComponents(preliminary, info.width, info.height);
  const foreground = components.foreground;
  const bounds = boundsFor(foreground, info.width, info.height);
  if (!bounds) throw new Error(`${expectation.candidateId}: final packshot has no visible subject.`);
  const largestBounds = boundsFor(components.largestMask, info.width, info.height);
  if (!largestBounds) throw new Error(`${expectation.candidateId}: final packshot has no principal subject.`);
  const subjectWidthFraction = bounds.width / info.width;
  const subjectHeightFraction = bounds.height / info.height;
  const subjectAreaFraction = subjectWidthFraction * subjectHeightFraction;
  const centerOffsetX = Math.abs((bounds.left + bounds.right) / 2 - info.width / 2) / info.width;
  const centerOffsetY = Math.abs((bounds.top + bounds.bottom) / 2 - info.height / 2) / info.height;

  const edgeBand = Math.max(1, Math.round(Math.min(info.width, info.height) * 0.012));
  let edgePixels = 0;
  let foregroundEdgePixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x >= edgeBand && x < info.width - edgeBand && y >= edgeBand && y < info.height - edgeBand) continue;
      edgePixels += 1;
      if (foreground[y * info.width + x]) foregroundEdgePixels += 1;
    }
  }
  const edgeContactFraction = foregroundEdgePixels / Math.max(1, edgePixels);
  const surface = surfaceBackgroundMetrics(raw, foreground, info.channels);
  const largestComponentAreaFraction = components.largestPixelCount / pixelCount;
  const largestComponentFillFraction = components.largestPixelCount / (largestBounds.width * largestBounds.height);
  const neutralComponents = significantComponents(lightNeutralMask(raw, pixelCount, info.channels), info.width, info.height);
  const neutralBounds = boundsFor(neutralComponents.largestMask, info.width, info.height);
  const lightNeutralPlaneAreaFraction = neutralComponents.largestPixelCount / pixelCount;
  const lightNeutralPlaneBoundsFraction = neutralBounds
    ? (neutralBounds.width * neutralBounds.height) / pixelCount
    : 0;
  const lightNeutralPlaneFillFraction = neutralBounds
    ? neutralComponents.largestPixelCount / (neutralBounds.width * neutralBounds.height)
    : 0;
  const opaqueTopology = largestComponentTopology(opaqueMask, info.width, info.height);
  const partialAlphaTopology = largestComponentTopology(partialAlphaMask, info.width, info.height);
  const metrics: CataloguePublicationImageMetrics = {
    zeroAlphaFraction: zeroAlpha / pixelCount,
    transparentFraction: transparent / pixelCount,
    partiallyTransparentFraction: partiallyTransparent / pixelCount,
    opaqueFraction: opaque / pixelCount,
    subjectWidthFraction,
    subjectHeightFraction,
    subjectAreaFraction,
    centerOffsetX,
    centerOffsetY,
    edgeContactFraction,
    surfaceBackgroundMeanDelta: surface.mean,
    surfaceBackgroundP90Delta: surface.p90,
    largestComponentAreaFraction,
    largestComponentFillFraction,
    lightNeutralPlaneAreaFraction,
    lightNeutralPlaneBoundsFraction,
    lightNeutralPlaneFillFraction,
    opaquePlaneAreaFraction: opaqueTopology.areaFraction,
    opaquePlaneBoundsFraction: opaqueTopology.boundsFraction,
    opaquePlaneFillFraction: opaqueTopology.fillFraction,
    opaquePlanePerimeterFraction: opaqueTopology.perimeterFraction,
    partialAlphaPlaneAreaFraction: partialAlphaTopology.areaFraction,
    partialAlphaPlaneBoundsFraction: partialAlphaTopology.boundsFraction,
    partialAlphaPlaneFillFraction: partialAlphaTopology.fillFraction,
    partialAlphaPlanePerimeterFraction: partialAlphaTopology.perimeterFraction,
  };

  if (metrics.zeroAlphaFraction < 0.12 || metrics.transparentFraction < 0.15) {
    throw new Error(`${expectation.candidateId}: final packshot does not have enough genuinely transparent canvas.`);
  }
  if (isBroadCanvasPlane(partialAlphaTopology, 0.35)) {
    throw new Error(`${expectation.candidateId}: final packshot contains a broad semi-transparent plane.`);
  }
  if (metrics.opaqueFraction < 0.03) throw new Error(`${expectation.candidateId}: final packshot subject is too faint.`);
  if (metrics.edgeContactFraction > 0.01 || subjectWidthFraction > 0.96 || subjectHeightFraction > 0.96) {
    throw new Error(`${expectation.candidateId}: final packshot is clipped or lacks safe canvas padding.`);
  }
  if (subjectHeightFraction < 0.35 || subjectAreaFraction < 0.035) {
    throw new Error(`${expectation.candidateId}: final packshot subject is too small.`);
  }
  if (centerOffsetX > 0.18 || centerOffsetY > 0.18) {
    throw new Error(`${expectation.candidateId}: final packshot is too far off-centre.`);
  }
  if (surface.mean > 2.5 || surface.p90 > 4) {
    throw new Error(`${expectation.candidateId}: final packshot leaves a visible plane on peach, pink or dark.`);
  }
  if (isBroadCanvasPlane(opaqueTopology, 0.94)) {
    throw new Error(`${expectation.candidateId}: final packshot contains an inset opaque canvas.`);
  }

  return { ...expectation, decodedFormat, metrics };
}

function declaredContentLength(response: Response, candidateId: string) {
  const value = response.headers.get('content-length');
  if (value == null) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${candidateId}: final image response length is invalid.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${candidateId}: final image response length is invalid.`);
  return parsed;
}

async function responseBytes(response: Response, candidateId: string, maxBytes: number) {
  const declaredLength = declaredContentLength(response, candidateId);
  if (declaredLength != null && declaredLength > maxBytes) {
    throw new Error(`${candidateId}: final image exceeds the byte limit.`);
  }
  if (!response.body) throw new Error(`${candidateId}: final image response has no body.`);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${candidateId}: final image exceeds the byte limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function verifyRemoteCataloguePublicationImage(
  expectation: CataloguePublicationImageExpectation,
  options: RemoteCataloguePublicationImageVerificationOptions = {},
) {
  assertExpectation(expectation);
  const notFoundRetryDelaysMs = options.notFoundRetryDelaysMs ?? [0];
  if (
    !notFoundRetryDelaysMs.length
    || notFoundRetryDelaysMs.length > 20
    || notFoundRetryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)
    || notFoundRetryDelaysMs.reduce((total, delay) => total + delay, 0) > 600_000
  ) {
    throw new Error(`${expectation.candidateId}: final image 404 retry schedule is invalid.`);
  }

  for (let attempt = 0; attempt < notFoundRetryDelaysMs.length; attempt += 1) {
    const delay = notFoundRetryDelaysMs[attempt] ?? 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    const response = await (options.fetchImpl ?? fetch)(expectation.url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      headers: { Accept: expectation.mimeType },
    });
    if (response.status === 404 && attempt + 1 < notFoundRetryDelaysMs.length) {
      await response.body?.cancel();
      continue;
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`${expectation.candidateId}: final image URL redirects and is not immutable.`);
    }
    if (response.status !== 200) throw new Error(`${expectation.candidateId}: final image returned ${response.status}, not 200.`);
    if (response.url && response.url !== expectation.url) {
      throw new Error(`${expectation.candidateId}: final image response URL changed.`);
    }
    const responseMimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const declaredLength = declaredContentLength(response, expectation.candidateId);
    if (declaredLength != null && declaredLength !== expectation.byteSize) {
      throw new Error(`${expectation.candidateId}: final image response length changed.`);
    }
    const bytes = await responseBytes(
      response,
      expectation.candidateId,
      Math.min(cataloguePublicationImageMaxBytes, expectation.byteSize),
    );
    return verifyCataloguePublicationImageBytes(expectation, bytes, responseMimeType);
  }

  throw new Error(`${expectation.candidateId}: final image verification did not run.`);
}
