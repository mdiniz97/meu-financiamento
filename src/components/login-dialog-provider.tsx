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
  LOGIN_PARAM,
  LOGIN_VALUE,
  NEXT_PARAM,
  clearLoginParams,
  loginHrefOn,
  sanitizeNext,
} from '@/lib/login-redirect';

interface LoginDialogContextValue {
  open: boolean;
  /** Caminho pretendido antes do login, já sanitizado. */
  next: string | null;
  openLogin: (next?: string) => void;
  closeLogin: () => void;
}

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null);

interface LoginState {
  open: boolean;
  next: string | null;
}

/**
 * Sincroniza `?login=1` da URL com o estado do modal. Fica **dentro de um
 * `Suspense`** de propósito: `useSearchParams` num Client Component de rota
 * pré-renderizada obriga a subárvore até o boundary a virar client-side. Preso
 * aqui, só este componente perde o SSR — o resto da árvore segue estático.
 */
function LoginUrlSync({ onUrl }: { onUrl: (state: LoginState) => void }) {
  const searchParams = useSearchParams();
  const open = searchParams.get(LOGIN_PARAM) === LOGIN_VALUE;
  const next = searchParams.get(NEXT_PARAM);

  useEffect(() => {
    onUrl({ open, next: sanitizeNext(next) });
  }, [onUrl, open, next]);

  return null;
}

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<LoginState>({ open: false, next: null });

  const onUrl = useCallback((fromUrl: LoginState) => setState(fromUrl), []);

  const openLogin = useCallback(
    (target?: string) => {
      setState({ open: true, next: sanitizeNext(target) });
      router.push(loginHrefOn(pathname, target), { scroll: false });
    },
    [router, pathname]
  );

  const closeLogin = useCallback(() => {
    setState({ open: false, next: null });
    // Lê a query do browser em vez de `useSearchParams`: mantém este callback
    // fora do boundary de Suspense.
    router.replace(`${pathname}${clearLoginParams(window.location.search)}`, { scroll: false });
  }, [router, pathname]);

  const value = useMemo(
    () => ({ open: state.open, next: state.next, openLogin, closeLogin }),
    [state.open, state.next, openLogin, closeLogin]
  );

  return (
    <LoginDialogContext.Provider value={value}>
      <Suspense fallback={null}>
        <LoginUrlSync onUrl={onUrl} />
      </Suspense>
      {children}
    </LoginDialogContext.Provider>
  );
}

export function useLoginDialog(): LoginDialogContextValue {
  const ctx = useContext(LoginDialogContext);
  if (!ctx) throw new Error('useLoginDialog precisa estar dentro de LoginDialogProvider');
  return ctx;
}
