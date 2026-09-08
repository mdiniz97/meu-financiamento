import type { Metadata } from 'next';

export const SITE_NAME = 'amortiza.me';
export const SITE_URL = 'https://amortiza.me';
export const SITE_DESCRIPTION =
  'Simule seu financiamento imobiliário, compare SAC e PRICE, planeje amortizações e confira juros e custos da compra. Entenda os números antes de decidir.';
export const SITE_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} - Entenda seu financiamento. Planeje sua quitação.`,
};

export function publicMetadata({
  title,
  description,
  path,
  modifiedTime,
}: {
  title: string;
  description: string;
  path: string;
  modifiedTime?: string;
}): Metadata {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: modifiedTime ? 'article' : 'website',
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'pt_BR',
      images: [SITE_IMAGE],
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [{ url: SITE_IMAGE.url, alt: SITE_IMAGE.alt }],
    },
  };
}
