import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i0.wp.com' },
      { protocol: 'https', hostname: 'peronabeauty.com' },
      { protocol: 'https', hostname: 'www.agtplaza.com' },
      { protocol: 'https', hostname: 'nigeria.lushhairafrica.com' },
      { protocol: 'https', hostname: 'sliquebeautylimited.com' },
      { protocol: 'https', hostname: 'perfectpicturecosmetics.com' },
      { protocol: 'https', hostname: 'www.caretobeauty.com' }
    ]
  }
};

export default nextConfig;
