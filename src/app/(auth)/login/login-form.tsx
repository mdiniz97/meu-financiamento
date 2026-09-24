'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { GoogleButton } from '@/components/google-button';
import { emailLoginEnabled } from '@/lib/auth-mode';

const DEFAULT_REDIRECT = '/nova-simulacao';

/**
 * Conteúdo do login, sem casca de página: é renderizado dentro do modal
 * (`LoginDialog`). O título/descrição ficam no `DialogHeader`.
 */
export function LoginForm({ callbackUrl = null }: { callbackUrl?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const target = callbackUrl ?? DEFAULT_REDIRECT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Email ou senha incorretos');
        return;
      }
      router.push(target);
      router.refresh();
    } catch {
      setError('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (!emailLoginEnabled()) {
    return (
      <div className="flex flex-col gap-3">
        <GoogleButton label="Entrar com Google" callbackUrl={target} />
        <p className="text-center text-xs text-muted-foreground">
          Login por email e senha disponível apenas em desenvolvimento.
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton label="Entrar com Google" callbackUrl={target} />
      <p className="mt-4 text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link
          href="/cadastro"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </>
  );
}
