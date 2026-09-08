import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArticleHeader } from '@/components/landing/Article';

describe('tempo de leitura do artigo', () => {
  it.each([
    { words: 0, minutes: 1 },
    { words: 200, minutes: 1 },
    { words: 201, minutes: 2 },
    { words: 401, minutes: 3 },
  ])('calcula $minutes minuto(s) para $words palavras, sem estimativa manual antiga', ({ words, minutes }) => {
    const artigo = {
      slug: 'exemplo', title: 'Guia', description: 'Descrição curta', updatedAt: '2026-09-08',
      readMinutes: 99,
      cta: { label: 'Simular', href: '/nova-simulacao' },
      sources: [{ label: 'Fonte', href: 'https://www.bcb.gov.br/' }],
      blocks: [{ type: 'p' as const, text: Array(words).fill('palavra').join(' ') }],
    };
    const html = renderToStaticMarkup(createElement(ArticleHeader, { artigo }));
    expect(html).toContain(`${minutes} min de leitura`);
    expect(html).toContain('dateTime="2026-09-08"');
  });
});
