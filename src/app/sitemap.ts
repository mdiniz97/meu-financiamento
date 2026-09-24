import type { MetadataRoute } from 'next';
import { ARTIGOS } from '@/lib/artigos';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/juros` },
    { url: `${SITE_URL}/custos-da-compra` },
    { url: `${SITE_URL}/blog` },
    { url: `${SITE_URL}/termos` },
    { url: `${SITE_URL}/privacidade` },
    { url: `${SITE_URL}/cookies` },
    ...ARTIGOS.map((artigo) => ({
      url: `${SITE_URL}/blog/${artigo.slug}`,
      lastModified: artigo.updatedAt,
    })),
  ];
}
