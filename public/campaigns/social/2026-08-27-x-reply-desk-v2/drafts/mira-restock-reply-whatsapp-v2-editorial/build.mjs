import sharp from "/Users/dyrane/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs";

const outputDirectory = new URL("./", import.meta.url).pathname;
const referencePath = new URL(
  "./reference-thread-capture.png",
  import.meta.url,
).pathname;
const gifPath = new URL(
  "../../publications/mira-last-two-drops-overtime/mira-last-two-drops-watermarked.gif",
  import.meta.url,
).pathname;

const gifMetadata = await sharp(gifPath, { animated: true }).metadata();
const frameCount = gifMetadata.pages ?? 1;
const delays = Array.isArray(gifMetadata.delay)
  ? gifMetadata.delay
  : Array(frameCount).fill(gifMetadata.delay ?? 900);

const sourceAvatar = await sharp(referencePath)
  .extract({ left: 35, top: 30, width: 130, height: 145 })
  .resize(116, 129, { fit: "fill" })
  .png()
  .toBuffer();

const sourceIdentity = await sharp(referencePath)
  .extract({ left: 180, top: 40, width: 430, height: 55 })
  .resize(430, 55, { fit: "fill" })
  .png()
  .toBuffer();

const sourceText = await sharp(referencePath)
  .extract({ left: 180, top: 105, width: 1025, height: 115 })
  .resize(900, 101, { fit: "fill" })
  .png()
  .toBuffer();

const replyAvatar = await sharp(referencePath)
  .extract({ left: 35, top: 345, width: 130, height: 140 })
  .resize(116, 126, { fit: "fill" })
  .png()
  .toBuffer();

const replyIdentity = await sharp(referencePath)
  .extract({ left: 180, top: 350, width: 400, height: 58 })
  .resize(400, 58, { fit: "fill" })
  .png()
  .toBuffer();

const replyText = await sharp(referencePath)
  .extract({ left: 180, top: 420, width: 1025, height: 105 })
  .resize(900, 92, { fit: "fill" })
  .png()
  .toBuffer();

const connector = Buffer.from(`
  <svg width="1080" height="1920">
    <line x1="93" y1="178" x2="93" y2="310" stroke="#39414a" stroke-width="4"/>
  </svg>
`);

const frames = [];
for (let index = 0; index < frameCount; index += 1) {
  const gifFrame = await sharp(gifPath, { page: index, pages: 1 })
    .resize(900, 1350, { fit: "fill" })
    .png()
    .toBuffer();
  const gifMask = Buffer.from(
    '<svg width="900" height="1350"><rect width="900" height="1350" rx="28" fill="white"/></svg>',
  );
  const gifCard = await sharp(gifFrame)
    .composite([{ input: gifMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const frame = await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: connector, left: 0, top: 0 },
      { input: sourceAvatar, left: 35, top: 55 },
      { input: sourceIdentity, left: 160, top: 62 },
      { input: sourceText, left: 160, top: 126 },
      { input: replyAvatar, left: 35, top: 280 },
      { input: replyIdentity, left: 160, top: 286 },
      { input: replyText, left: 160, top: 348 },
      { input: gifCard, left: 150, top: 470 },
    ])
    .raw()
    .toBuffer();
  frames.push(frame);
}

const stackedFrames = Buffer.concat(frames);
await sharp(stackedFrames, {
  raw: {
    width: 1080,
    height: 1920 * frameCount,
    channels: 4,
    pageHeight: 1920,
  },
})
  .gif({
    loop: 0,
    delay: delays,
    colours: 256,
    effort: 7,
    dither: 0.6,
  })
  .toFile(`${outputDirectory}mira-restock-thread-whatsapp-status-v2.gif`);

await sharp(frames[0], {
  raw: { width: 1080, height: 1920, channels: 4 },
})
  .png()
  .toFile(`${outputDirectory}mira-restock-thread-whatsapp-poster-v2.png`);

console.log(JSON.stringify({ frameCount, delays }));
