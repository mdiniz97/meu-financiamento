import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import { ARTIGOS } from '@/lib/artigos';

describe('sitemap', () => {
  const urls = sitemap().map((entry) => entry.url);

  it('inclui as páginas públicas principais', () => {
    expect(urls).toContain('https://amortiza.me');
    expect(urls).toContain('https://amortiza.me/juros');
    expect(urls).toContain('https://amortiza.me/custos-da-compra');
    expect(urls).toContain('https://amortiza.me/negociacao');
    expect(urls).toContain('https://amortiza.me/blog');
  });

  it('não inclui páginas privadas/transacionais', () => {
    for (const priv of ['/assinar', '/perfil', '/login', '/cadastro', '/minhas-simulacoes']) {
      expect(urls.some((u) => u.includes(priv))).toBe(false);
    }
  });

  it('inclui todos os artigos do blog', () => {
    for (const artigo of ARTIGOS) {
      expect(urls).toContain(`https://amortiza.me/blog/${artigo.slug}`);
    }
  });
});
