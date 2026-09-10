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
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { recalibrate } from '@/app/(app)/meu-financiamento/actions';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formulário do dialog de recalibração. Só é montado com o dialog aberto
 * (estado inicial fresco a cada abertura); o submit fica desabilitado durante
 * o envio (duplo clique). O fechamento em voo é barrado pelo pai, que conhece
 * o `pending`.
 */
function RecalibrateForm({
  saldoEfetivo,
  primeiraPendente,
  diaVencimento,
  pending,
  onPendingChange,
  onClose,
}: {
  saldoEfetivo: number;
  primeiraPendente: number;
  diaVencimento: number;
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saldoDevedor, setSaldoDevedor] = useState(roundCents(saldoEfetivo));
  const [dataBase, setDataBase] = useState(todayISO());
  const [proximaParcela, setProximaParcela] = useState(primeiraPendente);
  const [dia, setDia] = useState(diaVencimento);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (pending || !dataBase || !Number.isInteger(proximaParcela) || proximaParcela < 1) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      result = await recalibrate({
        saldoDevedor,
        dataBase,
        proximaParcelaNumero: proximaParcela,
        diaVencimento: dia,
      });
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

  const invalido = !dataBase
    || !Number.isInteger(proximaParcela) || proximaParcela < 1
    || !Number.isInteger(dia) || dia < 1 || dia > 31;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Recalibrar saldo pelo extrato</DialogTitle>
        <DialogDescription>
          Registre o saldo devedor e a competência que aparecem no extrato do banco.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="recSaldo" className="text-sm font-medium text-foreground">
            Saldo devedor (R$)
          </label>
          <MoneyInput id="recSaldo" name="saldoDevedor" value={saldoDevedor} onValid={setSaldoDevedor} disabled={pending} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recData" className="text-sm font-medium text-foreground">
              Data-base
            </label>
            <Input
              id="recData"
              name="dataBase"
              type="date"
              value={dataBase}
              onChange={(e) => setDataBase(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recDia" className="text-sm font-medium text-foreground">
              Dia do vencimento
            </label>
            <NumericInput
              id="recDia"
              name="diaVencimento"
              value={dia}
              parse={parseIntStrict}
              onValid={setDia}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="recParcela" className="text-sm font-medium text-foreground">
            Número da próxima parcela
          </label>
          <NumericInput
            id="recParcela"
            name="proximaParcelaNumero"
            value={proximaParcela}
            parse={parseIntStrict}
            onValid={setProximaParcela}
            disabled={pending}
          />
        </div>
        <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Isso redefine a verdade do saldo pelo extrato do banco. Pagamentos anteriores a essa data não são
          reaplicados.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Saldo atual no modelo: {formatBRL(saldoEfetivo)}. Se o extrato zera o saldo, o contrato é encerrado como
          quitado.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={pending || invalido}>
          {pending ? 'Confirmando...' : 'Confirmar recalibração'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Dialog de recalibração pelo extrato do banco: redefine o baseline (saldo,
 * data-base e próxima parcela) sem reaplicar lançamentos anteriores. Saldo 0
 * encerra o contrato como quitado (a action grava source 'quitacao').
 * Abre a partir do banner de divergência do dashboard; o conteúdo só existe
 * com o dialog aberto e é bloqueado de fechar durante o envio.
 */
export function RecalibrateDialog({
  open,
  onOpenChange,
  saldoEfetivo,
  primeiraPendente,
  diaVencimento,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenchimento de "Saldo devedor (R$)". */
  saldoEfetivo: number;
  /** Pré-preenchimento de "Número da próxima parcela". */
  primeiraPendente: number;
  /** Pré-preenchimento de "Dia do vencimento". */
  diaVencimento: number;
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
        <RecalibrateForm
          saldoEfetivo={saldoEfetivo}
          primeiraPendente={primeiraPendente}
          diaVencimento={diaVencimento}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
