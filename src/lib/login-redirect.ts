/**
 * Fonte única da URL de login. O login deixou de ser uma página própria: virou
 * um modal sobre a home, aberto por `?login=1`.
 *
 * `next` passa por `sanitizeNext` para impedir **open redirect** — só caminho
 * relativo interno. Sem isso, `?next=https://evil.com` transformaria a nossa
 * tela de login num trampolim de phishing.
 */
export const LOGIN_PARAM = 'login';
export const NEXT_PARAM = 'next';
export const LOGIN_VALUE = '1';

export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  // `//host` e `/\host` são interpretados como outro host pelo browser.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** Monta a URL do modal preservando um caminho base (ex.: a página atual). */
export function loginHrefOn(pathname: string, next?: unknown): string {
  const params = new URLSearchParams();
  params.set(LOGIN_PARAM, LOGIN_VALUE);
  const safe = sanitizeNext(next);
  if (safe) params.set(NEXT_PARAM, safe);
  return `${pathname}?${params.toString()}`;
}

/**
 * Destino usado pelo servidor quando uma página protegida é acessada sem
 * sessão: manda para a **home** com o modal aberto, guardando o caminho
 * pretendido em `next`.
 */
export function loginHref(next?: unknown): string {
  return loginHrefOn('/', next);
}

/** Query string sem os parâmetros de login, para limpar a URL ao fechar. */
export function clearLoginParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(LOGIN_PARAM);
  params.delete(NEXT_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
