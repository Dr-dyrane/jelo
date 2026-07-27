import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const stagedProductAssetHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com';
export const stagedCatalogueIntakeAssetDirectory = 'data/catalogue-intake-assets';

type StagedProductAssetContentType =
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/jpeg';

type StagedProductAssetPromotionBase = {
  id: string;
  active: boolean;
  sourceUrl: string;
  localPath: string;
  blobPath: string;
  blobUrl: string;
  contentType: StagedProductAssetContentType;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
};

export type PublicProductAssetPromotion = StagedProductAssetPromotionBase & {
  productSlug: string;
  candidateId?: never;
};

export type PrivateCatalogueIntakeAssetPromotion = StagedProductAssetPromotionBase & {
  candidateId: string;
  destination: 'private-staging';
  publicationBrandSlug?: never;
  productSlug?: never;
};

export type CataloguePublicationAssetPromotion = StagedProductAssetPromotionBase & {
  candidateId: string;
  destination: 'publication';
  publicationBrandSlug: string;
  productSlug?: never;
};

export type CatalogueIntakeAssetPromotion =
  | PrivateCatalogueIntakeAssetPromotion
  | CataloguePublicationAssetPromotion;

export type StagedProductAssetPromotion =
  | PublicProductAssetPromotion
  | CatalogueIntakeAssetPromotion;

type PromotionBlobRead = {
  statusCode: 200 | 304;
  stream: ReadableStream<Uint8Array> | null;
  blob: {
    url: string;
    pathname: string;
    contentType: string | null;
    size: number | null;
  };
};

export type StagedProductAssetBlobClient = {
  get: (
    pathname: string,
    options: { access: 'public'; useCache: false },
  ) => Promise<PromotionBlobRead | null>;
  put: (
    pathname: string,
    body: Buffer,
    options: {
      access: 'public';
      contentType: StagedProductAssetContentType;
      addRandomSuffix: false;
      allowOverwrite: false;
      cacheControlMaxAge: number;
    },
  ) => Promise<{
    url: string;
    pathname: string;
    contentType: string;
  }>;
};

const targetIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const supportedExtensionByContentType: Record<StagedProductAssetContentType, readonly string[]> = {
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'image/jpeg': ['jpg', 'jpeg'],
};

function promotionTarget(promotion: StagedProductAssetPromotion) {
  const productSlug = 'productSlug' in promotion ? promotion.productSlug : undefined;
  const candidateId = 'candidateId' in promotion ? promotion.candidateId : undefined;
  if (Boolean(productSlug) === Boolean(candidateId)) {
    throw new Error(`${promotion.id}: exactly one productSlug or candidateId is required`);
  }
  const id = productSlug ?? candidateId;
  if (!id || !targetIdPattern.test(id)) {
    throw new Error(`${promotion.id}: promotion target is invalid`);
  }
  if (productSlug) return { kind: 'public-product' as const, id: productSlug };

  const candidatePromotion = promotion as CatalogueIntakeAssetPromotion;
  return candidatePromotion.destination === 'publication'
    ? {
        kind: 'catalogue-publication' as const,
        id: candidateId as string,
        brandSlug: candidatePromotion.publicationBrandSlug,
      }
    : { kind: 'catalogue-intake' as const, id: candidateId as string };
}

function normalizedRepositoryPath(value: string, label: string) {
  if (!value || value.includes('\\') || value.startsWith('/') || path.posix.normalize(value) !== value) {
    throw new Error(`${label} must be a normalized repository-relative path`);
  }
  return value;
}

function extensionForPromotion(promotion: StagedProductAssetPromotion) {
  const extension = path.posix.extname(promotion.blobPath).slice(1).toLowerCase();
  if (!supportedExtensionByContentType[promotion.contentType]?.includes(extension)) {
    throw new Error(`${promotion.id}: Blob extension and content type disagree`);
  }
  return extension;
}

export function assertStagedProductAssetPromotion(
  promotion: StagedProductAssetPromotion,
) {
  if (!promotion.id || !targetIdPattern.test(promotion.id)) {
    throw new Error('Staged asset promotion ID is invalid');
  }
  if (!sha256Pattern.test(promotion.contentHash)) {
    throw new Error(`${promotion.id}: content hash is invalid`);
  }
  if (
    !Number.isInteger(promotion.byteSize)
    || promotion.byteSize <= 0
    || !Number.isInteger(promotion.width)
    || promotion.width <= 0
    || !Number.isInteger(promotion.height)
    || promotion.height <= 0
  ) {
    throw new Error(`${promotion.id}: image metadata is invalid`);
  }

  const source = new URL(promotion.sourceUrl);
  const destination = new URL(promotion.blobUrl);
  if (source.protocol !== 'https:') throw new Error(`${promotion.id}: source must use HTTPS`);
  if (
    destination.protocol !== 'https:'
    || destination.hostname !== stagedProductAssetHost
    || destination.search
    || destination.hash
  ) {
    throw new Error(`${promotion.id}: destination is outside the JeloCare Blob store`);
  }
  normalizedRepositoryPath(promotion.blobPath, `${promotion.id} Blob path`);
  if (destination.pathname !== `/${promotion.blobPath}`) {
    throw new Error(`${promotion.id}: Blob URL and pathname disagree`);
  }
  const extension = extensionForPromotion(promotion);
  const target = promotionTarget(promotion);

  if (target.kind === 'public-product') {
    if (!promotion.localPath.startsWith('/products/')) {
      throw new Error(`${promotion.id}: public product asset must be staged under public/products`);
    }
    const relativeLocalPath = promotion.localPath.replace(/^\/+/, '');
    normalizedRepositoryPath(relativeLocalPath, `${promotion.id} local path`);
    if (
      !promotion.blobPath.startsWith('products/')
      || !promotion.blobPath.includes(`/${target.id}/`)
    ) {
      throw new Error(`${promotion.id}: Blob path does not match productSlug`);
    }
    const publicFilename = path.posix.basename(promotion.blobPath);
    if (!new RegExp(`^packshot-v[1-9]\\d*\\.${extension}$`).test(publicFilename)) {
      throw new Error(`${promotion.id}: public product Blob path must contain an immutable version`);
    }
    return target;
  }

  const privatePrefix = `${stagedCatalogueIntakeAssetDirectory}/${target.id}/`;
  if (promotion.localPath.startsWith('/') || promotion.localPath.startsWith('public/')) {
    throw new Error(`${promotion.id}: private candidate bytes must stay outside public/`);
  }
  const localPath = normalizedRepositoryPath(promotion.localPath, `${promotion.id} local path`);
  if (!localPath.startsWith(privatePrefix)) {
    throw new Error(`${promotion.id}: private candidate bytes must stay outside public/`);
  }
  if (target.kind === 'catalogue-intake') {
    if (!promotion.blobPath.startsWith(`catalogue-intake/${target.id}/`)) {
      throw new Error(`${promotion.id}: Blob path does not match candidateId`);
    }
    const candidateFilename = path.posix.basename(promotion.blobPath);
    const candidateFilenameMatch = candidateFilename.match(
      new RegExp(`^packshot-v[1-9]\\d*-([0-9a-f]{12,64})\\.${extension}$`),
    );
    if (
      !candidateFilenameMatch
      || !promotion.contentHash.startsWith(candidateFilenameMatch[1])
    ) {
      throw new Error(
        `${promotion.id}: private candidate Blob path must contain a version and matching hash prefix`,
      );
    }
    return target;
  }

  if (!targetIdPattern.test(target.brandSlug)) {
    throw new Error(`${promotion.id}: publication brand slug is invalid`);
  }
  const publicationFilename = path.posix.basename(promotion.blobPath);
  const publicationFilenameMatch = publicationFilename.match(
    new RegExp(`^packshot-v[1-9]\\d*-([0-9a-f]{16,64})\\.${extension}$`),
  );
  if (
    promotion.blobPath !== `products/${target.brandSlug}/${target.id}/${publicationFilename}`
    || !publicationFilenameMatch
    || !promotion.contentHash.startsWith(publicationFilenameMatch[1])
  ) {
    throw new Error(
      `${promotion.id}: publication Blob path must bind the brand, candidate, version and content hash`,
    );
  }
  return target;
}

export function resolveStagedProductAssetPath(
  promotion: StagedProductAssetPromotion,
  repositoryRoot = process.cwd(),
) {
  const target = assertStagedProductAssetPromotion(promotion);
  const allowedRoot = target.kind === 'public-product'
    ? path.resolve(repositoryRoot, 'public')
    : path.resolve(repositoryRoot, stagedCatalogueIntakeAssetDirectory, target.id);
  const relativePath = target.kind === 'public-product'
    ? promotion.localPath.replace(/^\/+/, '')
    : path.posix.relative(`${stagedCatalogueIntakeAssetDirectory}/${target.id}`, promotion.localPath);
  const resolved = path.resolve(allowedRoot, relativePath);
  if (!resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`${promotion.id}: staged asset escapes its allowed directory`);
  }
  return resolved;
}

export async function verifyCatalogueIntakePromotionBinding(
  promotion: CatalogueIntakeAssetPromotion,
  repositoryRoot = process.cwd(),
) {
  const target = assertStagedProductAssetPromotion(promotion);
  if (target.kind === 'public-product') {
    throw new Error(`${promotion.id}: expected a catalogue candidate promotion`);
  }
  const sourcePath = path.resolve(
    repositoryRoot,
    'data/catalogue-intake-candidates',
    `${target.id}.json`,
  );
  const source = JSON.parse(await readFile(sourcePath, 'utf8')) as {
    publicationStatus?: unknown;
    candidate?: {
      id?: unknown;
      brand?: unknown;
      asset?: { sourceUrl?: unknown };
    };
  };
  if (
    source.publicationStatus !== 'private-research-only'
    || source.candidate?.id !== target.id
    || source.candidate.asset?.sourceUrl !== promotion.sourceUrl
  ) {
    throw new Error(`${promotion.id}: candidate source-asset binding is invalid`);
  }
  if (
    target.kind === 'catalogue-publication'
    && (
      typeof source.candidate.brand !== 'string'
      || source.candidate.brand
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') !== target.brandSlug
    )
  ) {
    throw new Error(`${promotion.id}: publication brand binding is invalid`);
  }
}

async function readRemoteBytes(stream: ReadableStream<Uint8Array>) {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function sameImmutableBlobUrl(left: string, right: string) {
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);
  return leftUrl.protocol === rightUrl.protocol
    && leftUrl.hostname === rightUrl.hostname
    && leftUrl.port === rightUrl.port
    && leftUrl.username === rightUrl.username
    && leftUrl.password === rightUrl.password
    && leftUrl.pathname === rightUrl.pathname
    && leftUrl.search === rightUrl.search
    && leftUrl.hash === rightUrl.hash;
}

export async function verifyExistingRemoteStagedProductAsset(
  promotion: StagedProductAssetPromotion,
  client: Pick<StagedProductAssetBlobClient, 'get'>,
) {
  assertStagedProductAssetPromotion(promotion);
  const remote = await client.get(promotion.blobPath, {
    access: 'public',
    useCache: false,
  });
  if (!remote) return false;
  if (
    remote.statusCode !== 200
    || !remote.stream
    || !sameImmutableBlobUrl(remote.blob.url, promotion.blobUrl)
    || remote.blob.pathname !== promotion.blobPath
    || remote.blob.contentType !== promotion.contentType
    || remote.blob.size !== promotion.byteSize
  ) {
    throw new Error(`${promotion.id}: existing remote Blob metadata does not match staged bytes`);
  }
  const remoteBytes = await readRemoteBytes(remote.stream);
  const remoteHash = createHash('sha256').update(remoteBytes).digest('hex');
  if (remoteBytes.length !== promotion.byteSize || remoteHash !== promotion.contentHash) {
    throw new Error(`${promotion.id}: existing remote Blob bytes do not match staged bytes`);
  }
  return true;
}

export async function promoteVerifiedStagedProductAsset(
  promotion: StagedProductAssetPromotion,
  bytes: Buffer,
  client: StagedProductAssetBlobClient,
  options: {
    postWriteVerificationDelaysMs?: readonly number[];
  } = {},
) {
  if (await verifyExistingRemoteStagedProductAsset(promotion, client)) {
    return 'verified-existing' as const;
  }

  const verifyAfterCreate = async () => {
    const delays = options.postWriteVerificationDelaysMs ?? [0, 100, 250, 500, 1_000];
    for (const delay of delays) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (await verifyExistingRemoteStagedProductAsset(promotion, client)) {
        return true;
      }
    }
    return false;
  };

  let uploaded: Awaited<ReturnType<StagedProductAssetBlobClient['put']>>;
  try {
    uploaded = await client.put(promotion.blobPath, bytes, {
      access: 'public',
      contentType: promotion.contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 31_536_000,
    });
  } catch (error) {
    // Another build can win the create-only race. Skip only after proving that
    // the now-existing immutable object has the exact reviewed bytes.
    if (await verifyAfterCreate()) {
      return 'verified-existing' as const;
    }
    throw error;
  }

  if (
    !sameImmutableBlobUrl(uploaded.url, promotion.blobUrl)
    || uploaded.pathname !== promotion.blobPath
    || uploaded.contentType !== promotion.contentType
  ) {
    throw new Error(`${promotion.id}: Blob returned an unexpected immutable location`);
  }
  if (!await verifyAfterCreate()) {
    throw new Error(`${promotion.id}: uploaded Blob could not be independently verified`);
  }
  return 'uploaded' as const;
}
