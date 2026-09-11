'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { registerAmortization } from '@/app/(app)/meu-financiamento/actions';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { EfeitoAporte, type EstadoProjecao } from './efeito-aporte';

export function OrigemRadios({
  value,
  onChange,
  disabled,
}: {
  value: 'proprio' | 'fgts';
  onChange: (v: 'proprio' | 'fgts') => void;
  disabled: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as 'proprio' | 'fgts')}
      aria-label="Origem dos recursos"
      className="grid-flow-col justify-start gap-6"
      disabled={disabled}
    >
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="proprio" />
        Dinheiro próprio
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="fgts" />
        FGTS
      </label>
    </RadioGroup>
  );
}

export function ModoRadios({
  value,
  onChange,
  disabled,
}: {
  value: 'term' | 'payment';
  onChange: (v: 'term' | 'payment') => void;
  disabled: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as 'term' | 'payment')}
      aria-label="O que o banco fez"
      className="justify-start gap-6"
      disabled={disabled}
    >
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="term" />
        Reduziu o prazo (parcela igual)
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="payment" />
        Reduziu a parcela (prazo igual)
      </label>
    </RadioGroup>
  );
}

/**
 * Formulário de registro de amortização. Só é montado com o dialog aberto
 * (estado inicial fresco a cada abertura); o submit fica desabilitado durante
 * o envio (duplo clique serializado inseriria duas linhas iguais, não há
 * índice único). O fechamento em voo é barrado pelo pai, que conhece o
 * `pending`.
 */
function AmortizacaoForm({
  pending,
  onPendingChange,
  onClose,
  estado,
}: {
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
  estado: EstadoProjecao;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(0);
  const [dataPagamento, setDataPagamento] = useState(todayISO());
  const [origem, setOrigem] = useState<'proprio' | 'fgts'>('proprio');
  const [modo, setModo] = useState<'term' | 'payment'>('term');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (pending || valor <= 0 || !dataPagamento) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      result = await registerAmortization({ valor, dataPagamento, origem, modo });
    } catch {
      onPendingChange(false);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      onPendingChange(false);
      setError(result.error);
      return;
    }
    await router.refresh();
    onPendingChange(false);
    onClose();
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Registrar amortização extra</DialogTitle>
        <DialogDescription>
          Amortização feita por fora da parcela, como o banco registrou no extrato.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amortValor" className="text-sm font-medium text-foreground">
            Valor amortizado (R$)
          </label>
          <MoneyInput id="amortValor" name="valor" value={valor} onValid={setValor} disabled={pending} />
          <EfeitoAporte estado={estado} aporte={valor} modo={modo} mostrarParcelaEstimada />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amortData" className="text-sm font-medium text-foreground">
            Data do pagamento
          </label>
          <Input
            id="amortData"
            name="dataPagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Origem</span>
          <OrigemRadios value={origem} onChange={setOrigem} disabled={pending} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">O que o banco fez</span>
          <ModoRadios value={modo} onChange={setModo} disabled={pending} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={pending || valor <= 0 || !dataPagamento}>
          {pending ? 'Registrando...' : 'Confirmar amortização'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Dialog de registro de amortização extra: controlado pelo dashboard (botão
 * "Registrei amortização" no cabeçalho). O conteúdo só existe com o dialog
 * aberto e o fechamento em voo é barrado.
 */
export function AmortizacaoDialog({
  open,
  onOpenChange,
  estado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estado: EstadoProjecao;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v || !pending) onOpenChange(v);
      }}
    >
      {open && (
        <AmortizacaoForm
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
          estado={estado}
        />
      )}
    </Dialog>
  );
}
