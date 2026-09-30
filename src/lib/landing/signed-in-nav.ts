/**
 * Item de navegação para usuário autenticado nas páginas públicas (landing,
 * blog, legal). O Ilimitado tem uma área de financiamento própria; quem não é
 * Ilimitado vai para o simulador.
 */
export function signedInNavItem(unlimited: boolean): { href: string; label: string } {
  return unlimited
    ? { href: '/meu-financiamento', label: 'Meu financiamento' }
    : { href: '/nova-simulacao', label: 'Simulações' };
}
