import { describe, expect, it } from 'vitest';
import { NAV } from './app-sidebar';

describe('app navigation', () => {
  it('exposes plans and credits from authenticated navigation', () => {
    expect(NAV).toContainEqual(
      expect.objectContaining({ href: '/perfil', label: 'Planos e créditos' })
    );
  });
});
