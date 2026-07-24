import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Shared building blocks for the app's dynamic OpenGraph images (nodejs runtime).
// Keeping them here means every OG route renders with the same fonts, the same
// resilient image loading, and the same naira handling.

export const OG_SIZE = { width: 1200, height: 630 };

// The self-hosted OG fonts live beside the share route; this exact fs path is the
// one proven to bundle into the serverless function in production.
const fontDir = join(process.cwd(), 'app', 'share', '[slug]', '_og');

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
 * Fetch an image (with a timeout) and inline it as a data URL, so generation never
 * hangs on a slow asset and a failed fetch degrades to a card without the image
 * rather than failing the whole build.
 */
export async function loadImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('content-type') ?? 'image/png';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// The Latin font subset carries no naira glyph, so spell it out in images only.
export const ngn = (label: string) => label.replace('₦', 'NGN ');
