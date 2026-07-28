import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

type NextTrace = {
  version: number;
  files: string[];
};

const routePath = path.join(
  process.cwd(),
  '.next',
  'server',
  'app',
  'api',
  'products',
  'suggestions',
  'route.js',
);
const tracePath = `${routePath}.nft.json`;

// These ceilings deliberately leave room for the public projection to grow
// toward 1,000 products while rejecting the former private research graph.
const maximumTraceFiles = 170;
const maximumTraceBytes = 2.5 * 1024 * 1024;

const forbiddenPathFragments = [
  '/data/catalogue-intake',
  '/data/catalogue-offer-source-evidence',
  '/data/catalogue-publication',
  '/data/catalogue-research',
  '/data/catalogue-discovery',
  '/data/catalogue-identity',
  '/data/external-catalogue',
  '/data/external-products',
];

// Both unreleased products are stable canaries for the private intake graph
// that previously entered this endpoint's server chunk.
const forbiddenContent = [
  'dang-niacinamide-n-acetyl-glucosamine-serum-30ml',
  'dang-hydra-glow-sun-protection-gel-60ml',
  'catalogue-publication-dossiers',
  'catalogue-intake-candidates',
];

function parseTrace(value: unknown): NextTrace {
  if (
    !value
    || typeof value !== 'object'
    || !('version' in value)
    || typeof value.version !== 'number'
    || !('files' in value)
    || !Array.isArray(value.files)
    || !value.files.every(file => typeof file === 'string')
  ) {
    throw new Error('The catalogue suggestion server trace is malformed.');
  }
  return value as NextTrace;
}

async function main() {
  const trace = parseTrace(JSON.parse(await readFile(tracePath, 'utf8')) as unknown);
  if (trace.files.length > maximumTraceFiles) {
    throw new Error(
      `Catalogue suggestion trace expanded to ${trace.files.length} files; limit is ${maximumTraceFiles}.`,
    );
  }

  const traceDirectory = path.dirname(tracePath);
  const files = [...new Set([
    routePath,
    ...trace.files.map(file => path.resolve(traceDirectory, file)),
  ])];
  const normalizedPaths = files.map(file => file.replaceAll(path.sep, '/').toLowerCase());
  const pathViolation = normalizedPaths.find(file =>
    forbiddenPathFragments.some(fragment => file.includes(fragment)),
  );
  if (pathViolation) {
    throw new Error(`Private catalogue path entered the public search bundle: ${pathViolation}`);
  }

  let totalBytes = 0;
  let combinedText = '';
  for (const file of files) {
    const fileStat = await stat(file);
    totalBytes += fileStat.size;
    if (
      fileStat.size <= 8 * 1024 * 1024
      && /\.(?:c?js|mjs|json|map)$/i.test(file)
    ) {
      combinedText += `\n${(await readFile(file, 'utf8')).toLowerCase()}`;
    }
  }

  if (totalBytes > maximumTraceBytes) {
    throw new Error(
      `Catalogue suggestion trace expanded to ${(totalBytes / 1024 / 1024).toFixed(2)} MiB; limit is ${(maximumTraceBytes / 1024 / 1024).toFixed(2)} MiB.`,
    );
  }
  for (const marker of forbiddenContent) {
    if (combinedText.includes(marker)) {
      throw new Error(`Private catalogue marker entered the public search bundle: ${marker}`);
    }
  }
  if (!combinedText.includes('public-catalogue-search')) {
    throw new Error('The approved public catalogue search projection is missing from the server bundle.');
  }

  console.log(
    `Verified public catalogue suggestion bundle: ${trace.files.length} traced files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB, private graph absent.`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
