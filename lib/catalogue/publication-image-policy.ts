export const cataloguePublicationAssetHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com' as const;
export const cataloguePublicationImageMimeTypes = ['image/png', 'image/webp'] as const;
export const cataloguePublicationImageMaxBytes = 20 * 1024 * 1024;
export const cataloguePublicationImageMinSide = 1_600;
export const cataloguePublicationImageMaxSide = 4_096;
export const cataloguePublicationSurfaces = {
  peach: '#f1d3cc',
  pink: '#edcbd3',
  dark: '#392825',
} as const;
export const cataloguePublicationSurfaceRgb: ReadonlyArray<readonly [number, number, number]> = [
  [241, 211, 204],
  [237, 203, 211],
  [57, 40, 37],
];

export type CataloguePublicationImageMimeType = typeof cataloguePublicationImageMimeTypes[number];

const mimeExtension: Record<CataloguePublicationImageMimeType, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isCataloguePublicationImageMimeType(value: unknown): value is CataloguePublicationImageMimeType {
  return cataloguePublicationImageMimeTypes.includes(value as CataloguePublicationImageMimeType);
}

export function assertCataloguePublicationImageLocation(
  candidateId: string,
  value: string,
  mimeType: CataloguePublicationImageMimeType,
  sha256: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${candidateId}: final image URL is invalid.`);
  }

  if (
    url.protocol !== 'https:'
    || url.hostname !== cataloguePublicationAssetHost
    || url.port
    || url.username
    || url.password
    || url.search
    || url.hash
  ) throw new Error(`${candidateId}: final image must use the trusted immutable asset location.`);

  const extension = mimeExtension[mimeType];
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`${candidateId}: final image hash is invalid.`);
  const contentAddress = sha256.slice(0, 16);
  const candidatePath = new RegExp(
    `^/products/[^/]+/${escapeRegExp(candidateId)}/packshot-v[1-9]\\d*-${contentAddress}\\.${extension}$`,
  );
  if (!candidatePath.test(url.pathname)) {
    throw new Error(`${candidateId}: final image path must bind the exact candidate, version and content hash.`);
  }
  return url;
}
