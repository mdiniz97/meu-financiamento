import { describe, expect, it } from 'vitest';
import { NAV } from './app-sidebar';

describe('app navigation', () => {
  it('exposes plans and credits from authenticated navigation', () => {
    expect(NAV).toContainEqual(
      expect.objectContaining({ href: '/perfil', label: 'Planos e créditos' })
    );
  });

  it('keeps Meu financiamento visible without a contract gate', () => {
    expect(NAV).toContainEqual(
      expect.objectContaining({ href: '/meu-financiamento', label: 'Meu financiamento' })
    );
    expect(NAV.find((item) => item.href === '/meu-financiamento')).not.toHaveProperty('requiresContract');
  });
});
