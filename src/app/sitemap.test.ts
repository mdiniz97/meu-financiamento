import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

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

  it('inclui os artigos do blog', () => {
    expect(urls.some((u) => u.includes('/blog/'))).toBe(true);
  });
});
