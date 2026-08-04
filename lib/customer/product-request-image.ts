import 'server-only';

import { createHash } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import sharp from 'sharp';
import type { CustomerProductRequestImageMetadata } from './product-request-repository';

export const MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_DIMENSION = 1600;

const ALLOWED_INPUT_TYPES = new Map([
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function ownerPathSegment(ownerSubject: string) {
  return createHash('sha256').update(ownerSubject, 'utf8').digest('hex').slice(0, 32);
}

export async function storePrivateCustomerProductRequestImage(input: {
  ownerSubject: string;
  requestId: string;
  idempotencyKey: string;
  file: File;
}): Promise<CustomerProductRequestImageMetadata> {
  const expectedFormat = ALLOWED_INPUT_TYPES.get(input.file.type.toLocaleLowerCase('en-US'));
  if (!expectedFormat) throw new Error('unsupported_image_type');
  if (input.file.size < 1 || input.file.size > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES) {
    throw new Error('invalid_image_size');
  }

  const source = Buffer.from(await input.file.arrayBuffer());
  if (source.byteLength < 1 || source.byteLength > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES) {
    throw new Error('invalid_image_size');
  }

  const pipeline = sharp(source, {
    animated: false,
    failOn: 'error',
    limitInputPixels: 40_000_000,
    sequentialRead: true,
  });
  const metadata = await pipeline.metadata();
  if (metadata.format !== expectedFormat || (metadata.pages ?? 1) !== 1) {
    throw new Error('image_type_mismatch');
  }

  const output = await pipeline
    .rotate()
    .resize({
      width: MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_DIMENSION,
      height: MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  if (
    output.data.byteLength < 1
    || output.data.byteLength > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES
    || output.info.width < 1
    || output.info.height < 1
    || output.info.width > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_DIMENSION
    || output.info.height > MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_DIMENSION
  ) {
    throw new Error('invalid_processed_image');
  }

  const contentSha256 = createHash('sha256').update(output.data).digest('hex');
  const pathname = [
    'customer-product-requests',
    ownerPathSegment(input.ownerSubject),
    input.requestId,
    `${input.idempotencyKey}-${contentSha256.slice(0, 16)}.webp`,
  ].join('/');
  const stored = await put(pathname, output.data, {
    access: 'private',
    contentType: 'image/webp',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  if (stored.pathname !== pathname) throw new Error('private_image_path_mismatch');

  return {
    blobPathname: stored.pathname,
    byteSize: output.data.byteLength,
    pixelWidth: output.info.width,
    pixelHeight: output.info.height,
    contentSha256,
  };
}

export async function readPrivateCustomerProductRequestImage(blobPathname: string) {
  return get(blobPathname, { access: 'private' });
}

export async function deletePrivateCustomerProductRequestImage(blobPathname: string) {
  await del(blobPathname);
}
