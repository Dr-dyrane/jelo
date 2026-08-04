import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/go', '/image-audit', '/me', '/ops', '/sign-in'],
    },
    sitemap: 'https://www.jelocare.com/sitemap.xml',
  };
}
