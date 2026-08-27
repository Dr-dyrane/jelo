import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const packshotPath = path.join(root, "source", "approved-packshot.png");
const outputPath = path.join(
  root,
  "final",
  "eucerin-current-price-story-2026-08-26-v2.png",
);

const width = 1080;
const height = 1920;

const backdrop = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="field" cx="50%" cy="63%" r="56%">
      <stop offset="0" stop-color="#2b130b"/>
      <stop offset="0.42" stop-color="#0c0806"/>
      <stop offset="1" stop-color="#000000"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ff7417" stop-opacity="0.27"/>
      <stop offset="1" stop-color="#ff7417" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>

  <rect width="1080" height="1920" fill="url(#field)"/>
  <text x="120" y="284" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" font-weight="650" fill="#fffaf4">JeloCare</text>
  <text x="960" y="276" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="3" fill="#aaa6a2">OBSERVED IN NIGERIA</text>

  <text x="540" y="456" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="54" font-weight="400" letter-spacing="-2" fill="#fffaf4">Current price.</text>
  <text x="540" y="570" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="88" font-weight="650" letter-spacing="-3" fill="#ff7417">₦20,500</text>

  <text x="540" y="660" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" fill="#d6d0ca">EUCERIN <tspan fill="#ff7417">·</tspan> Oil Control Sun Gel-Cream Dry Touch SPF 50+ <tspan fill="#ff7417">·</tspan> 50 ml</text>
  <text x="540" y="724" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" fill="#c3bdb7">In stock · Shadremmy Beauty</text>

  <ellipse cx="540" cy="1190" rx="430" ry="470" fill="url(#halo)"/>
  <ellipse cx="540" cy="1503" rx="250" ry="36" fill="#000" opacity="0.82" filter="url(#blur)"/>
  <ellipse cx="540" cy="1494" rx="200" ry="18" fill="#ff7417" opacity="0.16" filter="url(#blur)"/>

  <text x="120" y="1632" font-family="Helvetica Neue, Arial, sans-serif" font-size="23" fill="#aaa6a2">Prices change.</text>
  <text x="960" y="1632" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="23" fill="#aaa6a2">Observed 26 Aug 2026</text>
</svg>`;

const packshot = await sharp(packshotPath)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({ width: 550, height: 760, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();

const metadata = await sharp(packshot).metadata();
const left = Math.round((width - (metadata.width ?? 0)) / 2);
const top = 770;

await sharp(Buffer.from(backdrop))
  .composite([{ input: packshot, left, top }])
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
