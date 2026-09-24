import { describe, expect, it } from 'vitest';
import { emailButton, emailDetails, renderEmailLayout } from './layout';

describe('renderEmailLayout', () => {
  const out = renderEmailLayout({
    preheader: 'Prévia do assunto',
    title: 'Um título',
    contentHtml: '<p>Corpo</p>',
    cta: { label: 'Pagar agora', url: 'https://amortiza.me/pagar' },
  });

  it('é um documento HTML completo', () => {
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<html');
    expect(out).toContain('<head>');
    expect(out).toContain('</html>');
  });

  it('usa layout de tabela (não flex/grid)', () => {
    expect(out).toContain('<table');
    expect(out).not.toContain('display:flex');
    expect(out).not.toContain('display:grid');
  });

  it('não usa <style> nem classes: só estilo inline', () => {
    expect(out).not.toContain('<style');
    expect(out).not.toContain('class="');
  });

  it('respeita a marca: cor primária, cantos retos', () => {
    expect(out).toContain('#820ad1');
    expect(out).not.toContain('border-radius');
  });

  it('carrega o logo por URL absoluta', () => {
    expect(out).toContain('https://amortiza.me/brand/logo.png');
  });

  it('esconde o preheader mas o mantém no documento', () => {
    expect(out).toContain('Prévia do assunto');
    expect(out).toContain('text-indent:-9999px');
  });

  it('renderiza título e corpo', () => {
    expect(out).toContain('Um título');
    expect(out).toContain('<p>Corpo</p>');
  });

  it('renderiza o CTA como <a> estilizado (não <button>)', () => {
    expect(out).toContain('https://amortiza.me/pagar');
    expect(out).toContain('Pagar agora');
    expect(out).not.toContain('<button');
  });

  it('traz o rodapé institucional com CNPJ', () => {
    expect(out).toContain('54.569.947/0001-47');
    expect(out).toContain('amortiza.me');
  });

  it('escapa o título', () => {
    const risky = renderEmailLayout({ title: '<b>x</b>', contentHtml: '<p>y</p>' });
    expect(risky).not.toContain('<b>x</b>');
  });

  it('é válido sem CTA e sem título', () => {
    const minimal = renderEmailLayout({ contentHtml: '<p>só corpo</p>' });
    expect(minimal).toContain('<p>só corpo</p>');
    expect(minimal).toMatch(/^<!DOCTYPE html>/);
  });
});

describe('emailButton', () => {
  it('gera âncora com fundo primário, sem <button>', () => {
    const btn = emailButton({ label: 'Clique', url: 'https://x.test/a' });
    expect(btn).toContain('href="https://x.test/a"');
    expect(btn).toContain('#820ad1');
    expect(btn).not.toContain('<button');
  });
});

describe('emailDetails', () => {
  it('monta linhas rótulo/valor', () => {
    const html = emailDetails([
      { label: 'Valor', value: 'R$ 49,00' },
      { label: 'Vencimento', value: '10/09/2026' },
    ]);
    expect(html).toContain('Valor');
    expect(html).toContain('R$ 49,00');
    expect(html).toContain('Vencimento');
    expect(html).toContain('10/09/2026');
  });
});
