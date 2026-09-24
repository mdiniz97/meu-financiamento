import { describe, expect, it } from 'vitest';
import { clearLoginParams, loginHref, loginHrefOn, sanitizeNext } from './login-redirect';

describe('sanitizeNext', () => {
  it('aceita caminho interno absoluto', () => {
    expect(sanitizeNext('/minhas-simulacoes')).toBe('/minhas-simulacoes');
    expect(sanitizeNext('/plano?tab=creditos')).toBe('/plano?tab=creditos');
  });

  it('rejeita destino externo (evita open redirect)', () => {
    expect(sanitizeNext('https://evil.com')).toBeNull();
    expect(sanitizeNext('http://evil.com/x')).toBeNull();
    expect(sanitizeNext('//evil.com')).toBeNull();
    expect(sanitizeNext('/\\evil.com')).toBeNull();
    expect(sanitizeNext('javascript:alert(1)')).toBeNull();
  });

  it('rejeita vazio, não-string e caminho cru sem barra', () => {
    expect(sanitizeNext('')).toBeNull();
    expect(sanitizeNext(undefined)).toBeNull();
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext(123)).toBeNull();
    expect(sanitizeNext(['/a', '/b'])).toBeNull();
    expect(sanitizeNext('minhas-simulacoes')).toBeNull();
  });
});

describe('loginHref', () => {
  it('sem destino aponta para a home com o modal', () => {
    expect(loginHref()).toBe('/?login=1');
  });

  it('codifica o destino válido', () => {
    expect(loginHref('/minhas-simulacoes')).toBe('/?login=1&next=%2Fminhas-simulacoes');
  });

  it('descarta destino inválido em vez de repassar', () => {
    expect(loginHref('https://evil.com')).toBe('/?login=1');
    expect(loginHref('//evil.com')).toBe('/?login=1');
  });
});

describe('loginHrefOn', () => {
  it('abre o modal na página atual em vez de jogar para a home', () => {
    expect(loginHrefOn('/artigos/juros')).toBe('/artigos/juros?login=1');
  });

  it('carrega o destino quando faz sentido', () => {
    expect(loginHrefOn('/planos', '/meu-financiamento')).toBe(
      '/planos?login=1&next=%2Fmeu-financiamento'
    );
  });

  it('ignora destino inválido', () => {
    expect(loginHrefOn('/planos', '//evil.com')).toBe('/planos?login=1');
  });
});

describe('clearLoginParams', () => {
  it('remove login e next', () => {
    expect(clearLoginParams('?login=1&next=%2Fx')).toBe('');
    expect(clearLoginParams('?login=1')).toBe('');
  });

  it('preserva os outros parâmetros', () => {
    expect(clearLoginParams('?login=1&foo=bar')).toBe('?foo=bar');
    expect(clearLoginParams('?a=1&login=1&b=2')).toBe('?a=1&b=2');
  });

  it('sem nada a remover devolve o mesmo', () => {
    expect(clearLoginParams('?a=1')).toBe('?a=1');
    expect(clearLoginParams('')).toBe('');
  });
});
