'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoginForm } from '@/app/(auth)/login/login-form';
import { CadastroForm } from '@/app/(auth)/cadastro/cadastro-form';
import { useAuthDialog } from './auth-dialog-provider';

/**
 * Modal de autenticação, sobre a página atual. Login e cadastro são o **mesmo**
 * modal em modos diferentes — alternar entre eles não fecha nem navega.
 */
export function AuthDialog() {
  const { mode, next, close } = useAuthDialog();
  const isSignup = mode === 'signup';

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
    >
      <DialogContent className="sm:max-w-sm" overlayClassName="bg-black/40 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle>{isSignup ? 'Criar conta' : 'Entrar'}</DialogTitle>
          <DialogDescription>
            {isSignup ? 'Ganhe 2 créditos grátis para começar' : 'Acesse sua conta para continuar'}
          </DialogDescription>
        </DialogHeader>
        {isSignup ? <CadastroForm callbackUrl={next} /> : <LoginForm callbackUrl={next} />}
      </DialogContent>
    </Dialog>
  );
}
