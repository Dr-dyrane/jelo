import path from "node:path";
import sharp from "sharp";

const root = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.resolve(
  root,
  "../2026-08-25-chelsea-sofascore-product-front-three-meme-v5/final/chelsea-sofascore-product-front-three-feed.png",
);
const outputPath = path.join(
  root,
  "final",
  "teegav-product-front-three-reply.png",
);

// Remove only the simulated social-account header. Preserve the approved
// headline, SofaScore setup, exact packshots, product names, sizes, and roles.
await sharp(sourcePath)
  .extract({ left: 0, top: 120, width: 1080, height: 1190 })
  .png({ quality: 96, compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
