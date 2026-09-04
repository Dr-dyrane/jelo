import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const isVercelProduction =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

if (!isVercelProduction) {
  console.log(
    "Skipping the Chromium runtime pack: not a Vercel production install.",
  );
  process.exit(0);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDirectory);
const chromiumEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"));
const chromiumPackageRoot = dirname(dirname(chromiumEntry));
const chromiumBinDirectory = join(chromiumPackageRoot, "bin");
const publicDirectory = join(projectRoot, "public");
const outputPath = join(publicDirectory, "chromium-pack.tar");

if (!existsSync(chromiumBinDirectory)) {
  throw new Error(
    "The serverless Chromium binary directory was not installed; refusing to build a broken browser fallback.",
  );
}

mkdirSync(publicDirectory, { recursive: true });
rmSync(outputPath, { force: true });
execFileSync("tar", ["-cf", outputPath, "-C", chromiumBinDirectory, "."], {
  cwd: projectRoot,
  stdio: "inherit",
});

console.log("Prepared the production Chromium runtime pack.");
