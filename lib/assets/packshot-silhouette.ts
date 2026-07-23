import sharp from 'sharp';

export type PackshotSilhouetteMetrics = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  topTerminalRunFraction: number;
  bottomTerminalRunFraction: number;
  leftTerminalRunFraction: number;
  rightTerminalRunFraction: number;
  maximumTerminalRunFraction: number;
};

const alphaThreshold = 24;
const defaultAnalysisSize = 384;

function longestRun(length: number, present: (offset: number) => boolean) {
  let longest = 0;
  let current = 0;
  for (let offset = 0; offset < length; offset += 1) {
    if (present(offset)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest / Math.max(1, length);
}

export async function analysePackshotSilhouette(
  bytes: Buffer,
  analysisSize = defaultAnalysisSize,
): Promise<PackshotSilhouetteMetrics> {
  const { data, info } = await sharp(bytes, { animated: false, failOn: 'warning' })
    .ensureAlpha()
    .resize(analysisSize, analysisSize, { fit: 'fill', kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visible = (x: number, y: number) => (
    (data[(y * info.width + x) * info.channels + 3] ?? 255) >= alphaThreshold
  );

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!visible(x, y)) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('Packshot has no visible subject.');

  const width = right - left + 1;
  const height = bottom - top + 1;
  const topTerminalRunFraction = longestRun(width, offset => visible(left + offset, top));
  const bottomTerminalRunFraction = longestRun(width, offset => visible(left + offset, bottom));
  const leftTerminalRunFraction = longestRun(height, offset => visible(left, top + offset));
  const rightTerminalRunFraction = longestRun(height, offset => visible(right, top + offset));
  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    topTerminalRunFraction,
    bottomTerminalRunFraction,
    leftTerminalRunFraction,
    rightTerminalRunFraction,
    // Tall bottles and tubes can legitimately have long straight side walls at
    // their left or right extrema. A full-width horizontal terminal edge is the
    // inherited-crop signature this gate is designed to catch.
    maximumTerminalRunFraction: Math.max(topTerminalRunFraction, bottomTerminalRunFraction),
  };
}

export const likelyTruncatedPackshot = (metrics: PackshotSilhouetteMetrics) => (
  metrics.bottomTerminalRunFraction >= 0.95
);
