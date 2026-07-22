import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { products as coreProducts } from '../data/products';
import { expandedProducts } from '../data/expanded-products';

const manifestPath = path.resolve(process.cwd(), 'data/product-assets.json');
const allowedTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const extensions: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type AssetRecord = {
  sourceUrl: string;
  blobUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  contentHash: string;
  importedAt: string;
};

function segment(value: string) {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function putBlob(file: string, pathname: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('vercel', [
      'blob', 'put', file,
      '--access', 'public',
      '--pathname', pathname,
      '--allow-overwrite', 'true',
      '--cache-control-max-age', '31536000',
    ], { cwd: process.cwd(), env: process.env });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => {
      const match = output.match(/https:\/\/[^\s]+\.public\.blob\.vercel-storage\.com\/[^\s]+/);
      if (code === 0 && match) resolve(match[0]);
      else reject(new Error(output.trim() || `vercel blob put exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const force = process.argv.includes('--force');
  const catalogue = [...coreProducts, ...expandedProducts];
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, AssetRecord>;
  const stagingDirectory = await mkdtemp(path.join(tmpdir(), 'jelocare-product-assets-'));
  const failures: Array<{ slug: string; error: string }> = [];

  try {
    for (const product of catalogue) {
      if (!force && manifest[product.slug]?.blobUrl) {
        console.log(`↷ ${product.slug} already has a canonical Blob asset.`);
        continue;
      }

      try {
        const response = await fetch(product.image, {
          redirect: 'follow',
          signal: AbortSignal.timeout(25_000),
          headers: {
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1',
            'User-Agent': 'JeloCareAssetImporter/2.0',
          },
        });
        if (!response.ok) throw new Error(`source returned ${response.status}`);
        const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
        if (!allowedTypes.has(contentType)) throw new Error(`unsupported content type ${contentType || 'unknown'}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error('source image is empty or exceeds 12 MB');
        const metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height) throw new Error('source image dimensions are unavailable');

        const extension = extensions[contentType];
        const stagedFile = path.join(stagingDirectory, `${product.slug}.${extension}`);
        await writeFile(stagedFile, bytes);
        const pathname = `products/${segment(product.brand)}/${segment(product.slug)}/packshot.${extension}`;
        const blobUrl = await putBlob(stagedFile, pathname);

        manifest[product.slug] = {
          sourceUrl: product.image,
          blobUrl,
          contentType,
          byteSize: bytes.length,
          width: metadata.width,
          height: metadata.height,
          hasAlpha: metadata.hasAlpha,
          contentHash: createHash('sha256').update(bytes).digest('hex'),
          importedAt: new Date().toISOString(),
        };
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        console.log(`✓ ${product.slug} → ${blobUrl}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ slug: product.slug, error: message });
        console.error(`✗ ${product.slug}: ${message}`);
      }
    }
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }

  console.log(`Canonical product assets: ${Object.keys(manifest).length}/${catalogue.length}.`);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
