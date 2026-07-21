import 'server-only';

import { put, type PutBlobResult } from '@vercel/blob';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type ImportProductImageInput = {
  brandSlug: string;
  productSlug: string;
  sourceUrl: string;
  role?: 'packshot' | 'hero' | 'texture' | 'thumbnail';
  overwrite?: boolean;
};

function safeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/avif': return 'avif';
    case 'image/gif': return 'gif';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: throw new Error(`Unsupported image content type: ${contentType}`);
  }
}

export async function importProductImage({
  brandSlug,
  productSlug,
  sourceUrl,
  role = 'packshot',
  overwrite = false,
}: ImportProductImageInput): Promise<PutBlobResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured.');
  }

  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:') {
    throw new Error('Only HTTPS image sources are allowed.');
  }

  const response = await fetch(source, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1',
      'User-Agent': 'JeloCareAssetImporter/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Source image request failed with ${response.status}.`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`Source did not return a supported image (${contentType || 'unknown'}).`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) {
    throw new Error(`Source image exceeds ${MAX_SOURCE_BYTES} bytes.`);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_SOURCE_BYTES) {
    throw new Error('Source image is empty or exceeds the import limit.');
  }

  const pathname = [
    'products',
    safeSegment(brandSlug),
    safeSegment(productSlug),
    `${safeSegment(role)}.${extensionFor(contentType)}`,
  ].join('/');

  return put(pathname, body, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    cacheControlMaxAge: 31_536_000,
  });
}
