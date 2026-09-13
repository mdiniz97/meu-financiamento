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
import { RateField } from '@/components/ui/rate-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateContract } from '@/app/(app)/meu-financiamento/actions';
import type { ContractParams } from '@/lib/finance/meu-financiamento/model';
import { normalizeRate, type RateKind } from '@/lib/finance/rates';
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
  dataBase: dataBaseInicial,
  diaVencimento,
  stateVersion,
  pending,
  onPendingChange,
  onClose,
}: {
  params: ContractParams;
  saldoEfetivo: number;
  primeiraPendente: number;
  dataBase: string;
  diaVencimento: number;
  stateVersion: number;
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [bank, setBank] = useState(params.bank);
  const [system, setSystem] = useState<ContractParams['system']>(params.system);
  const [annualRate, setAnnualRate] = useState<number | undefined>(rateToPct(params.annualRate));
  const [annualRateKind, setAnnualRateKind] = useState<RateKind>('effective-annual');
  const [annualRateValid, setAnnualRateValid] = useState(true);
  const [trMonthly, setTrMonthly] = useState<number | undefined>(rateToPct(params.trMonthly));
  const [insuranceMonthly, setInsuranceMonthly] = useState(roundCents(params.insuranceMonthly));
  const [parcelasTotais, setParcelasTotais] = useState(params.parcelasTotais);
  const [saldoDevedor, setSaldoDevedor] = useState(roundCents(saldoEfetivo));
  const [dataBase, setDataBase] = useState(dataBaseInicial);
  const [proximaParcela, setProximaParcela] = useState(primeiraPendente);
  const [dia, setDia] = useState(diaVencimento);
  const [confirmouRetroativo, setConfirmouRetroativo] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (pending || invalido) return;
    onPendingChange(true);
    setError('');
    // A taxa digitada é interpretada conforme o tipo escolhido e convertida
    // para a efetiva a.a. que o contrato/modelo armazena.
    const annualRateEffective = normalizeRate(annualRate as number, annualRateKind).effectiveAnnual;
    let result;
    try {
      result = await updateContract({
        bank: bank.trim(),
        system,
        annualRate: annualRateEffective,
        trMonthly: (trMonthly as number) / 100,
        insuranceMonthly,
        parcelasTotais,
        saldoDevedor,
        dataBase,
        proximaParcelaNumero: proximaParcela,
        diaVencimento: dia,
        stateVersion,
        primeiraPendente,
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

  // Edição retroativa (parcela anterior à pendente) é destrutiva: apaga do
  // estado vigente os lançamentos posteriores à nova posição; exige confirmação
  // explícita antes de habilitar o Salvar.
  const parcelaAnterior = Number.isInteger(proximaParcela) && proximaParcela < primeiraPendente;

  // Limites do modelo: taxa efetiva 0..100% a.a. (validada pelo RateField após
  // converter o tipo escolhido), TR 0..10% a.m., seguro >= 0.
  const invalido = bank.trim() === ''
    || annualRate === undefined || !annualRateValid
    || trMonthly === undefined || !Number.isFinite(trMonthly) || trMonthly < 0 || trMonthly > 10
    || !Number.isFinite(insuranceMonthly) || insuranceMonthly < 0
    || !Number.isInteger(parcelasTotais) || parcelasTotais < 1 || parcelasTotais > 600
    || !Number.isFinite(saldoDevedor) || saldoDevedor <= 0
    || !dataBase
    || !Number.isInteger(proximaParcela) || proximaParcela < 1 || proximaParcela > parcelasTotais
    || !Number.isInteger(dia) || dia < 1 || dia > 31
    || (parcelaAnterior && !confirmouRetroativo);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
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
            <RateField
              id="editAnnualRate"
              label="Taxa de juros"
              value={annualRate}
              kind={annualRateKind}
              minEffectiveAnnual={0}
              onValueChange={setAnnualRate}
              onKindChange={setAnnualRateKind}
              onValidityChange={setAnnualRateValid}
            />
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
              <label htmlFor="editDia" className="text-sm font-medium text-foreground">
                Dia do vencimento
              </label>
              <NumericInput
                id="editDia"
                name="diaVencimento"
                value={dia}
                parse={parseIntStrict}
                onValid={setDia}
                disabled={pending}
              />
            </div>
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
          {parcelaAnterior && (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <p role="status">
                Editar para uma parcela anterior remove os pagamentos e amortizações posteriores do cálculo e do
                histórico. Esta ação não pode ser desfeita.
              </p>
              <label className="flex items-start gap-2 font-medium">
                <input
                  id="editConfirmarRetroativo"
                  type="checkbox"
                  checked={confirmouRetroativo}
                  onChange={(e) => setConfirmouRetroativo(e.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-3.5 accent-amber-700"
                />
                Entendi que os lançamentos posteriores serão removidos
              </label>
            </div>
          )}
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
          <Button type="submit" disabled={pending || invalido}>
            {pending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </form>
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
  dataBase,
  diaVencimento,
  stateVersion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parâmetros vigentes para o prefill dos campos contratuais. */
  params: ContractParams;
  /** Pré-preenchimento de "Saldo devedor atual (R$)". */
  saldoEfetivo: number;
  /** Pré-preenchimento de "Número da próxima parcela". */
  primeiraPendente: number;
  /** Pré-preenchimento de "Data-base" (baseline vigente). */
  dataBase: string;
  /** Pré-preenchimento de "Dia do vencimento". */
  diaVencimento: number;
  /** Versão do baseline vigente (guarda de concorrência contra outra aba). */
  stateVersion: number;
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
          dataBase={dataBase}
          diaVencimento={diaVencimento}
          stateVersion={stateVersion}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
