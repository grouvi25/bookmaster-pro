/**
 * Dynamic sitemap.xml для Яндекс/Google индексации.
 * Генерируется при каждом запросе (force-dynamic).
 */
import { MetadataRoute } from 'next';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.MARKETPLACE_URL || 'https://dealmaster.ru';

  // Статические страницы
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Динамические страницы мастеров
  let masterPages: MetadataRoute.Sitemap = [];
  try {
    const apiUrl = process.env.API_URL || 'http://api:8000/api/v1';
    const resp = await axios.get(`${apiUrl}/marketplace/search`, {
      params: { per_page: 200 },
      timeout: 10000,
    });
    const masters = resp.data?.masters || [];
    masterPages = masters.map((m: { slug: string }) => ({
      url: `${baseUrl}/masters/${m.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    // API недоступен — пустой sitemap мастеров
  }

  return [...staticPages, ...masterPages];
}
