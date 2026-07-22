import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i0.wp.com' },
      { protocol: 'https', hostname: 'peronabeauty.com' },
      { protocol: 'https', hostname: 'www.agtplaza.com' },
      { protocol: 'https', hostname: 'nigeria.lushhairafrica.com' },
      { protocol: 'https', hostname: 'perfectpicturecosmetics.com' },
      { protocol: 'https', hostname: 'www.caretobeauty.com' },
      { protocol: 'https', hostname: 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com' }
    ]
  }
};

export default nextConfig;
