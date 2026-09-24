'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoginForm } from '@/app/(auth)/login/login-form';
import { useLoginDialog } from './login-dialog-provider';

/**
 * Login como modal sobre a página atual. Reusa `LoginForm` inteiro — a única
 * diferença em relação à antiga página `/login` é a casca e o desfoque.
 */
export function LoginDialog() {
  const { open, next, closeLogin } = useLoginDialog();

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeLogin();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        overlayClassName="bg-black/40 backdrop-blur-md"
      >
        <DialogHeader>
          <DialogTitle>Entrar</DialogTitle>
          <DialogDescription>Acesse sua conta para continuar</DialogDescription>
        </DialogHeader>
        <LoginForm callbackUrl={next} />
      </DialogContent>
    </Dialog>
  );
}
