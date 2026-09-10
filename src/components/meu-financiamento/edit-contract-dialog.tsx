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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateContract } from '@/app/(app)/meu-financiamento/actions';
import type { ContractParams } from '@/lib/finance/meu-financiamento/model';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { parseDecimal } from '@/lib/utils';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fração (0,105) para o campo em % (10,5), sem lixo de ponto flutuante. */
function rateToPct(value: number): number {
  return Math.round(value * 100 * 1e4) / 1e4;
}

/**
 * Formulário do dialog de edição do contrato. Só é montado com o dialog aberto
 * (estado inicial fresco a cada abertura, com prefill do estado vigente); o
 * submit fica desabilitado durante o envio (duplo clique). O fechamento em voo
 * é barrado pelo pai, que conhece o `pending`.
 */
function EditContractForm({
  params,
  saldoEfetivo,
  primeiraPendente,
  pending,
  onPendingChange,
  onClose,
}: {
  params: ContractParams;
  saldoEfetivo: number;
  primeiraPendente: number;
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [bank, setBank] = useState(params.bank);
  const [system, setSystem] = useState<ContractParams['system']>(params.system);
  const [annualRate, setAnnualRate] = useState<number | undefined>(rateToPct(params.annualRate));
  const [trMonthly, setTrMonthly] = useState<number | undefined>(rateToPct(params.trMonthly));
  const [insuranceMonthly, setInsuranceMonthly] = useState(roundCents(params.insuranceMonthly));
  const [parcelasTotais, setParcelasTotais] = useState(params.parcelasTotais);
  const [saldoDevedor, setSaldoDevedor] = useState(roundCents(saldoEfetivo));
  const [dataBase, setDataBase] = useState(todayISO());
  const [proximaParcela, setProximaParcela] = useState(primeiraPendente);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (pending || invalido) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      result = await updateContract({
        bank: bank.trim(),
        system,
        annualRate: (annualRate as number) / 100,
        trMonthly: (trMonthly as number) / 100,
        insuranceMonthly,
        parcelasTotais,
        saldoDevedor,
        dataBase,
        proximaParcelaNumero: proximaParcela,
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

  const invalido = bank.trim() === ''
    || annualRate === undefined || !Number.isFinite(annualRate) || annualRate <= 0
    || trMonthly === undefined || !Number.isFinite(trMonthly) || trMonthly < 0
    || !Number.isInteger(parcelasTotais) || parcelasTotais < 1 || parcelasTotais > 600
    || !Number.isFinite(saldoDevedor) || saldoDevedor <= 0
    || !dataBase
    || !Number.isInteger(proximaParcela) || proximaParcela < 1 || proximaParcela > parcelasTotais;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Editar contrato</DialogTitle>
        <DialogDescription>
          Portabilidade, nova taxa ou sistema, acordo de prazo. O passado fica congelado; informe o saldo do extrato.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editBank" className="text-sm font-medium text-foreground">
              Banco
            </label>
            <Input
              id="editBank"
              name="bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Sistema</span>
            <Select
              value={system}
              onValueChange={(next) => {
                if (next === 'PRICE' || next === 'SAC') setSystem(next);
              }}
              disabled={pending}
            >
              <SelectTrigger aria-label="Sistema" className="w-full">
                <SelectValue>{system}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRICE">PRICE</SelectItem>
                <SelectItem value="SAC">SAC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editAnnualRate" className="text-sm font-medium text-foreground">
              Taxa anual efetiva (%)
            </label>
            <NumericInput
              id="editAnnualRate"
              name="annualRate"
              value={annualRate}
              parse={parseDecimal}
              onValid={setAnnualRate}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editTrMonthly" className="text-sm font-medium text-foreground">
              TR mensal (%)
            </label>
            <NumericInput
              id="editTrMonthly"
              name="trMonthly"
              value={trMonthly}
              parse={parseDecimal}
              onValid={setTrMonthly}
              disabled={pending}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editInsurance" className="text-sm font-medium text-foreground">
              Seguro mensal (R$)
            </label>
            <MoneyInput
              id="editInsurance"
              name="insuranceMonthly"
              value={insuranceMonthly}
              onValid={setInsuranceMonthly}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editParcelasTotais" className="text-sm font-medium text-foreground">
              Total de parcelas
            </label>
            <NumericInput
              id="editParcelasTotais"
              name="parcelasTotais"
              value={parcelasTotais}
              parse={parseIntStrict}
              onValid={setParcelasTotais}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="editSaldo" className="text-sm font-medium text-foreground">
            Saldo devedor atual (R$)
          </label>
          <MoneyInput
            id="editSaldo"
            name="saldoDevedor"
            value={saldoDevedor}
            onValid={setSaldoDevedor}
            disabled={pending}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editDataBase" className="text-sm font-medium text-foreground">
              Data-base
            </label>
            <Input
              id="editDataBase"
              name="dataBase"
              type="date"
              value={dataBase}
              onChange={(e) => setDataBase(e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editParcela" className="text-sm font-medium text-foreground">
              Número da próxima parcela
            </label>
            <NumericInput
              id="editParcela"
              name="proximaParcelaNumero"
              value={proximaParcela}
              parse={parseIntStrict}
              onValid={setProximaParcela}
              disabled={pending}
            />
          </div>
        </div>
        <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          A mudança vale da próxima parcela em diante; o histórico anterior não é recalculado.
        </p>
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
        <Button type="button" onClick={() => void handleSubmit()} disabled={pending || invalido}>
          {pending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Dialog de edição do contrato (portabilidade, nova taxa ou sistema, acordo de
 * prazo): grava uma versão nova do baseline com os parâmetros novos e congela
 * o passado. Abre a partir da faixa de ações do dashboard; o conteúdo só existe
 * com o dialog aberto e é bloqueado de fechar durante o envio.
 */
export function EditContractDialog({
  open,
  onOpenChange,
  params,
  saldoEfetivo,
  primeiraPendente,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parâmetros vigentes para o prefill dos campos contratuais. */
  params: ContractParams;
  /** Pré-preenchimento de "Saldo devedor atual (R$)". */
  saldoEfetivo: number;
  /** Pré-preenchimento de "Número da próxima parcela". */
  primeiraPendente: number;
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
        <EditContractForm
          params={params}
          saldoEfetivo={saldoEfetivo}
          primeiraPendente={primeiraPendente}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
