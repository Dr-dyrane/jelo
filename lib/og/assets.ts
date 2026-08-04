import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// Shared binary building blocks for the contextual social-card renderer.

export const OG_SIZE = { width: 1200, height: 630 };

// The self-hosted OG fonts live beside the share route; this exact fs path is the
// one proven to bundle into the serverless function in production.
const fontDir = join(process.cwd(), 'app', '(site)', 'share', '[slug]', '_og');

export async function loadOgFonts() {
  const [italiana, manrope, manropeSemibold] = await Promise.all([
    readFile(join(fontDir, 'italiana-400.ttf')),
    readFile(join(fontDir, 'manrope-400.ttf')),
    readFile(join(fontDir, 'manrope-600.ttf')),
  ]);
  return [
    { name: 'Italiana', data: italiana, weight: 400 as const },
    { name: 'Manrope', data: manrope, weight: 400 as const },
    { name: 'Manrope', data: manropeSemibold, weight: 600 as const },
  ];
}

export function absoluteImage(image: string) {
  return image.startsWith('http') ? image : `https://www.jelocare.com${image}`;
}

/**
 * Fetch an image (with a timeout) and inline it as a PNG data URL. Satori can only
 * decode PNG/JPEG, so every packshot is normalised to PNG via sharp (webp/avif
 * would otherwise crash the render) and downscaled to keep the data URL small. Any
 * failure degrades to a card without the image rather than breaking the build.
 */
export async function loadImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    const png = await sharp(input)
      .resize({ width: 660, height: 860, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}
