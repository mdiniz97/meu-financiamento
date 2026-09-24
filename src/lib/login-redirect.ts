/**
 * Fonte única da URL do modal de autenticação. Login e cadastro viraram um
 * modal sobre a página, aberto por `?login=1` ou `?signup=1`.
 *
 * `next` passa por `sanitizeNext` para impedir **open redirect** — só caminho
 * relativo interno. Sem isso, `?next=https://evil.com` transformaria a nossa
 * tela de login num trampolim de phishing.
 */
export const LOGIN_PARAM = 'login';
export const SIGNUP_PARAM = 'signup';
export const NEXT_PARAM = 'next';
export const LOGIN_VALUE = '1';

export type AuthMode = 'login' | 'signup';

const MODE_PARAM: Record<AuthMode, string> = {
  login: LOGIN_PARAM,
  signup: SIGNUP_PARAM,
};

export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  // `//host` e `/\host` são interpretados como outro host pelo browser.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** Monta a URL do modal preservando um caminho base (ex.: a página atual). */
export function authHrefOn(pathname: string, mode: AuthMode, next?: unknown): string {
  const params = new URLSearchParams();
  params.set(MODE_PARAM[mode], LOGIN_VALUE);
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
  return authHrefOn('/', 'login', next);
}

export function loginHrefOn(pathname: string, next?: unknown): string {
  return authHrefOn(pathname, 'login', next);
}

export function signupHref(next?: unknown): string {
  return authHrefOn('/', 'signup', next);
}

export function signupHrefOn(pathname: string, next?: unknown): string {
  return authHrefOn(pathname, 'signup', next);
}

/** Qual modal a URL pede, se algum. */
export function readAuthMode(search: string | URLSearchParams): AuthMode | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  if (params.get(LOGIN_PARAM) === LOGIN_VALUE) return 'login';
  if (params.get(SIGNUP_PARAM) === LOGIN_VALUE) return 'signup';
  return null;
}

/** Query string sem os parâmetros do modal, para limpar a URL ao fechar. */
export function clearAuthParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(LOGIN_PARAM);
  params.delete(SIGNUP_PARAM);
  params.delete(NEXT_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
