import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const packshotPath = path.join(root, "source", "approved-packshot.png");
const outputPath = path.join(root, "final", "eucerin-water-resistant-x-reply.png");

const width = 1080;
const height = 1350;

const backdrop = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="halo" cx="50%" cy="46%" r="54%">
      <stop offset="0" stop-color="#d85b10" stop-opacity="0.32"/>
      <stop offset="0.55" stop-color="#6d260e" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff7a1a"/>
      <stop offset="1" stop-color="#ffad66"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>

  <rect width="1080" height="1350" fill="#050505"/>
  <ellipse cx="540" cy="670" rx="520" ry="590" fill="url(#halo)"/>

  <text x="88" y="92" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="650" fill="#f6f3ee">JeloCare</text>
  <text x="992" y="88" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="16" font-weight="600" letter-spacing="3.2" fill="#9f9b96">FOUND FOR HOT DAYS</text>

  <text x="540" y="224" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="5.2" fill="#ff842a">WATER + SWEAT</text>
  <text x="540" y="308" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="76" font-weight="620" letter-spacing="-2" fill="#f8f5f0">RESISTANT.</text>
  <rect x="466" y="344" width="148" height="4" rx="2" fill="url(#line)"/>

  <ellipse cx="540" cy="1037" rx="280" ry="40" fill="#000000" opacity="0.78" filter="url(#blur)"/>
  <ellipse cx="540" cy="1027" rx="244" ry="23" fill="#a73c0f" opacity="0.24" filter="url(#blur)"/>

  <text x="88" y="1160" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="650" letter-spacing="2.4" fill="#ff842a">EUCERIN</text>
  <text x="88" y="1204" font-family="Helvetica Neue, Arial, sans-serif" font-size="31" font-weight="570" fill="#f6f3ee">Oil Control Sun Gel-Cream Dry Touch SPF 50+</text>
  <text x="88" y="1248" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" fill="#a9a49e">50 ml · Protect</text>
  <text x="992" y="1248" text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" fill="#a9a49e">Reapply after sweating.</text>
</svg>`;

const packshot = await sharp(packshotPath)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({ width: 410, height: 700, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();

const metadata = await sharp(packshot).metadata();
const left = Math.round((width - (metadata.width ?? 0)) / 2);
const top = 360;

await sharp(Buffer.from(backdrop))
  .composite([{ input: packshot, left, top }])
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
