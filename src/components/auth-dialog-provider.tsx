'use client';

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  NEXT_PARAM,
  authHrefOn,
  clearAuthParams,
  readAuthMode,
  sanitizeNext,
  type AuthMode,
} from '@/lib/login-redirect';

interface AuthDialogContextValue {
  /** Modal aberto, se algum. */
  mode: AuthMode | null;
  /** Caminho pretendido antes de autenticar, já sanitizado. */
  next: string | null;
  openLogin: (next?: string) => void;
  openSignup: (next?: string) => void;
  close: () => void;
  /** Fecha sem mexer na URL — para quando já vamos navegar para outro lugar. */
  dismiss: () => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

interface AuthState {
  mode: AuthMode | null;
  next: string | null;
}

/**
 * Sincroniza `?login=1` / `?signup=1` da URL com o estado do modal. Fica
 * **dentro de um `Suspense`** de propósito: `useSearchParams` num Client
 * Component de rota pré-renderizada obriga a subárvore até o boundary a virar
 * client-side. Preso aqui, só este componente perde o SSR — o resto da árvore
 * segue estático.
 */
function AuthUrlSync({ onUrl }: { onUrl: (state: AuthState) => void }) {
  const searchParams = useSearchParams();
  const mode = readAuthMode(searchParams);
  const next = searchParams.get(NEXT_PARAM);

  useEffect(() => {
    onUrl({ mode, next: sanitizeNext(next) });
  }, [onUrl, mode, next]);

  return null;
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({ mode: null, next: null });

  const onUrl = useCallback((fromUrl: AuthState) => setState(fromUrl), []);

  const open = useCallback(
    (mode: AuthMode, target?: string) => {
      setState({ mode, next: sanitizeNext(target) });
      router.push(authHrefOn(pathname, mode, target), { scroll: false });
    },
    [router, pathname]
  );

  const openLogin = useCallback((target?: string) => open('login', target), [open]);
  const openSignup = useCallback((target?: string) => open('signup', target), [open]);

  const close = useCallback(() => {
    setState({ mode: null, next: null });
    // Lê a query do browser em vez de `useSearchParams`: mantém este callback
    // fora do boundary de Suspense.
    router.replace(`${pathname}${clearAuthParams(window.location.search)}`, { scroll: false });
  }, [router, pathname]);

  const dismiss = useCallback(() => setState({ mode: null, next: null }), []);

  const value = useMemo(
    () => ({ mode: state.mode, next: state.next, openLogin, openSignup, close, dismiss }),
    [state.mode, state.next, openLogin, openSignup, close, dismiss]
  );

  return (
    <AuthDialogContext.Provider value={value}>
      <Suspense fallback={null}>
        <AuthUrlSync onUrl={onUrl} />
      </Suspense>
      {children}
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog(): AuthDialogContextValue {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error('useAuthDialog precisa estar dentro de AuthDialogProvider');
  return ctx;
}
