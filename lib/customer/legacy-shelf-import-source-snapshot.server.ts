import { gunzipSync } from 'node:zlib';

// Immutable gzip snapshots of the two hash-pinned pages-v1.0 source files.
// The Node-only decoder and focused dependency-graph gate keep these bytes out
// of every client module and browser bundle.
const PRODUCTS_GZIP_BASE64 = [
  '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',
].join('');

const ROUTINE_GZIP_BASE64 = [
  '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',
].join('');

export function readLegacyShelfImportSourceSnapshot() {
  return {
    productsSource: gunzipSync(Buffer.from(PRODUCTS_GZIP_BASE64, 'base64')),
    routineSource: gunzipSync(Buffer.from(ROUTINE_GZIP_BASE64, 'base64')),
  };
}
