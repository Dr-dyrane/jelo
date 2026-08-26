import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const source = (...parts) => path.join(root, "source", ...parts);
const final = (...parts) => path.join(root, "final", ...parts);
const preview = (...parts) => path.join(root, "preview", ...parts);

const width = 1500;
const height = 500;
const outputPath = final("jelocare-x-brand-header.png");

const toDataUri = async (file, mime = "image/png") =>
  `data:${mime};base64,${(await fs.readFile(file)).toString("base64")}`;

await sharp(source("quiet-signal-imagegen.png"))
  .resize(width, height, { fit: "cover", position: "centre" })
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

const [header, avatar] = await Promise.all([
  toDataUri(outputPath),
  toDataUri(source("jelocare-avatar.png")),
]);

const desktopPreview = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#000"/>
  <rect x="282" width="600" height="720" fill="#000" stroke="#2f3336"/>
  <rect x="282" width="600" height="53" fill="#000"/>
  <text x="356" y="24" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#f2f2f2">JeloCare</text>
  <text x="356" y="44" font-family="Arial, sans-serif" font-size="13" fill="#71767b">0 posts</text>
  <image x="282" y="53" width="600" height="200" preserveAspectRatio="xMidYMid slice" href="${header}"/>
  <circle cx="372" cy="253" r="72" fill="#000"/>
  <clipPath id="desktopAvatar"><circle cx="372" cy="253" r="66"/></clipPath>
  <image x="306" y="187" width="132" height="132" preserveAspectRatio="xMidYMid slice" clip-path="url(#desktopAvatar)" href="${avatar}"/>
  <circle cx="372" cy="253" r="67" fill="none" stroke="#000" stroke-width="5"/>
  <rect x="754" y="270" width="110" height="40" rx="20" fill="#000" stroke="#536471"/>
  <text x="809" y="296" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#eff3f4">Edit profile</text>
  <text x="300" y="360" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#eff3f4">JeloCare</text>
  <text x="300" y="384" font-family="Arial, sans-serif" font-size="15" fill="#71767b">@jelocare</text>
  <text x="300" y="440" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Joined August 2026</text>
  <text x="300" y="476" font-family="Arial, sans-serif" font-size="15" fill="#eff3f4">1</text>
  <text x="316" y="476" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Following</text>
  <text x="390" y="476" font-family="Arial, sans-serif" font-size="15" fill="#eff3f4">0</text>
  <text x="406" y="476" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Followers</text>
</svg>`;

await sharp(Buffer.from(desktopPreview))
  .png({ quality: 94, compressionLevel: 9 })
  .toFile(preview("jelocare-x-brand-desktop.png"));

const mobilePreview = `
<svg width="390" height="844" viewBox="0 0 390 844" xmlns="http://www.w3.org/2000/svg">
  <rect width="390" height="844" fill="#000"/>
  <rect width="390" height="70" fill="#000"/>
  <text x="54" y="31" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#eff3f4">JeloCare</text>
  <text x="54" y="51" font-family="Arial, sans-serif" font-size="12" fill="#71767b">0 posts</text>
  <image x="0" y="70" width="390" height="200" preserveAspectRatio="xMidYMid slice" href="${header}"/>
  <circle cx="74" cy="270" r="58" fill="#000"/>
  <clipPath id="mobileAvatar"><circle cx="74" cy="270" r="53"/></clipPath>
  <image x="21" y="217" width="106" height="106" preserveAspectRatio="xMidYMid slice" clip-path="url(#mobileAvatar)" href="${avatar}"/>
  <circle cx="74" cy="270" r="54" fill="none" stroke="#000" stroke-width="4"/>
  <rect x="272" y="288" width="103" height="38" rx="19" fill="#000" stroke="#536471"/>
  <text x="323" y="312" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#eff3f4">Edit profile</text>
  <text x="16" y="370" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#eff3f4">JeloCare</text>
  <text x="16" y="394" font-family="Arial, sans-serif" font-size="15" fill="#71767b">@jelocare</text>
  <text x="16" y="448" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Joined August 2026</text>
  <text x="16" y="486" font-family="Arial, sans-serif" font-size="15" fill="#eff3f4">1</text>
  <text x="31" y="486" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Following</text>
  <text x="108" y="486" font-family="Arial, sans-serif" font-size="15" fill="#eff3f4">0</text>
  <text x="124" y="486" font-family="Arial, sans-serif" font-size="15" fill="#71767b">Followers</text>
  <line x1="0" y1="534" x2="390" y2="534" stroke="#2f3336"/>
</svg>`;

await sharp(Buffer.from(mobilePreview))
  .png({ quality: 94, compressionLevel: 9 })
  .toFile(preview("jelocare-x-brand-mobile.png"));

console.log(outputPath);
