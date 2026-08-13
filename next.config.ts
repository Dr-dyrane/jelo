import type { NextConfig } from "next";

const verifiedVercelProductionBuild =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  process.env.JELO_VERCEL_RELEASE_TYPECHECK_PASSED === "1";

// Mobile simulators reach the local server over plain HTTP. Safari applies
// `upgrade-insecure-requests` to Next's relative CSS and JS assets as well,
// which leaves the page as raw HTML during device QA. Production keeps the
// upgrade directive; local development keeps the rest of the same CSP.
const transportUpgradeDirectives =
  process.env.NODE_ENV === "development" ? [] : ["upgrade-insecure-requests"];
const developmentScriptDirectives =
  process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  typescript: {
    ignoreBuildErrors: verifiedVercelProductionBuild,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "peronabeauty.com" },
      { protocol: "https", hostname: "www.agtplaza.com" },
      { protocol: "https", hostname: "nigeria.lushhairafrica.com" },
      { protocol: "https", hostname: "perfectpicturecosmetics.com" },
      { protocol: "https", hostname: "www.caretobeauty.com" },
      {
        protocol: "https",
        hostname: "m6aftkbqbwtkxooa.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              [
                "script-src 'self' 'unsafe-inline'",
                ...developmentScriptDirectives,
              ].join(" "),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              ...transportUpgradeDirectives,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
