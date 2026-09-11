'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ConfirmResult = { ok: true } | { ok: false; error: string };

/**
 * Diálogo de confirmação genérico para ações destrutivas (apagar lançamento,
 * desfazer pagamento). O pending e o erro da action vivem aqui: `onConfirm`
 * devolve `{ ok: false, error }` na falha (exibida em `role="alert"`) e o
 * diálogo só fecha no sucesso. O fechamento em voo é barrado.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<ConfirmResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function confirmar() {
    if (pending) return;
    setPending(true);
    setError('');
    let result: ConfirmResult;
    try {
      result = await onConfirm();
    } catch {
      result = { ok: false, error: 'Sessão expirada, entre novamente' };
    }
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setPending(false);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setError('');
        if (v || !pending) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmar()} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
