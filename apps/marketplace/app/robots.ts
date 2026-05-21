/**
 * robots.txt — управление индексацией.
 */
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.MARKETPLACE_URL || 'https://freelance-gid.online';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/embed/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
