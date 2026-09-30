import { expect, it } from 'vitest';
import { referralInvitationMessage } from './invitation-message';

it('monta convite pronto para compartilhar com link e regras corretas', () => {
  expect(referralInvitationMessage('https://amortiza.me/indicar/c/ABC123')).toBe(
    'Olá! Cadastre-se no amortiza.me pelo meu link: https://amortiza.me/indicar/c/ABC123\n\n' +
    'Você ganha 10 créditos ao criar sua conta. Depois da sua primeira simulação salva, nós dois ganhamos +5 créditos!'
  );
});
