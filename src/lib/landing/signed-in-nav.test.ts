import { describe, expect, it } from 'vitest';
import { signedInNavItem } from './signed-in-nav';

describe('signedInNavItem', () => {
  it('leva o usuário Ilimitado ao Meu financiamento', () => {
    expect(signedInNavItem(true)).toEqual({ href: '/meu-financiamento', label: 'Meu financiamento' });
  });

  it('leva o usuário sem Ilimitado ao simulador, rotulado Simulações', () => {
    expect(signedInNavItem(false)).toEqual({ href: '/nova-simulacao', label: 'Simulações' });
  });
});
