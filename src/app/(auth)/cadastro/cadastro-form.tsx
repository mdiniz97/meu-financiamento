'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleButton } from '@/components/google-button';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { useAuthDialog } from '@/components/auth-dialog-provider';

const DEFAULT_REDIRECT = '/nova-simulacao';

/**
 * Conteúdo do cadastro, sem casca de página: é renderizado dentro do
 * `AuthDialog`. O título/descrição ficam no `DialogHeader`.
 */
export function CadastroForm({ callbackUrl = null }: { callbackUrl?: string | null }) {
  const router = useRouter();
  const { openLogin, dismiss } = useAuthDialog();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const target = callbackUrl ?? DEFAULT_REDIRECT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Não foi possível criar a conta');
        return;
      }
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Conta criada, mas não foi possível entrar. Tente fazer login.');
        openLogin(callbackUrl ?? undefined);
        return;
      }
      dismiss();
      router.push(target);
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (!emailLoginEnabled()) {
    return (
      <div className="flex flex-col gap-3">
        <GoogleButton label="Criar conta com Google" callbackUrl={target} />
        <p className="text-center text-xs text-muted-foreground">
          Cadastro por email e senha disponível apenas em desenvolvimento.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <button
            type="button"
            onClick={() => openLogin(callbackUrl ?? undefined)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando conta…' : 'Criar conta e ganhar 2 créditos'}
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton label="Criar conta com Google" callbackUrl={target} />
      <p className="mt-4 text-sm text-muted-foreground">
        Já tem conta?{' '}
        <button
          type="button"
          onClick={() => openLogin(callbackUrl ?? undefined)}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </button>
      </p>
    </>
  );
}
