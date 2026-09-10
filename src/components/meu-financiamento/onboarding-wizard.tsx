'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Save, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpgradeCard } from '@/components/upgrade-card';
import { createContract, saveDraft } from '@/app/(app)/meu-financiamento/actions';
import { simulate } from '@/lib/finance/engine';
import { isValidDateString } from '@/lib/finance/meu-financiamento/model';
import { addMonthsISO, formatDataBr, formatMesAno } from '@/lib/meu-financiamento/dates';
import type { CreateContractInput } from '@/lib/meu-financiamento/repo';
import { cn, formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';

const UNLIMITED_ERROR = 'Recurso exclusivo do plano Ilimitado';
const INSURANCE_SPLIT = { taxPct: 0.25, insurancePct: 0.75 };

const TOTAL_STEPS = 4;

export interface MeuFinanciamentoDraftValues {
  bank: string;
  system: 'PRICE' | 'SAC';
  annualRate: string;
  trMonthly: string;
  insuranceMonthly: string;
  parcelasTotais: string;
  saldoDevedor: string;
  proximaParcelaNumero: string;
  dataBase: string;
  diaVencimento: string;
}

export interface MeuFinanciamentoDraft {
  step: number;
  values: MeuFinanciamentoDraftValues;
}

const EMPTY_VALUES: MeuFinanciamentoDraftValues = {
  bank: '',
  system: 'PRICE',
  annualRate: '',
  trMonthly: '',
  insuranceMonthly: '0,00',
  parcelasTotais: '',
  saldoDevedor: '0,00',
  proximaParcelaNumero: '',
  dataBase: '',
  diaVencimento: '',
};

/** Dia (sem zero à esquerda) de uma data ISO válida; '' quando inválida. */
function diaDaData(iso: string): string {
  return isValidDateString(iso) ? String(Number(iso.slice(8, 10))) : '';
}

function strField(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

export function sanitizeDraft(raw: unknown): MeuFinanciamentoDraft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const values = obj.values;
  if (typeof values !== 'object' || values === null) return null;
  const v = values as Record<string, unknown>;
  const step = typeof obj.step === 'number' && Number.isInteger(obj.step)
    ? Math.min(TOTAL_STEPS, Math.max(1, obj.step))
    : 1;
  const system = strField(v.system) === 'SAC' ? 'SAC' : 'PRICE';
  const money = (key: string) => {
    const s = strField(v[key]);
    return s.trim() === '' ? '0,00' : s;
  };
  const dataBase = strField(v.dataBase);
  const diaVencimento = strField(v.diaVencimento);
  // Rascunho antigo (criado antes do campo existir): deriva o dia da data-base
  // para o passo 3/4 continuar projetando; sem data-base, default 1.
  const diaDerivado = isValidDateString(dataBase) ? String(Number(dataBase.slice(8, 10))) : '1';
  return {
    step,
    values: {
      bank: strField(v.bank),
      system,
      annualRate: strField(v.annualRate),
      trMonthly: strField(v.trMonthly),
      insuranceMonthly: money('insuranceMonthly'),
      parcelasTotais: strField(v.parcelasTotais),
      saldoDevedor: money('saldoDevedor'),
      proximaParcelaNumero: strField(v.proximaParcelaNumero),
      dataBase,
      diaVencimento: diaVencimento.trim() === '' ? diaDerivado : diaVencimento,
    },
  };
}

function numberToPtBr(value: number): string {
  return String(value).replace('.', ',');
}

function fieldErrors(step: number, values: MeuFinanciamentoDraftValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 1) {
    const bank = values.bank.trim();
    if (!bank) errors.bank = 'Informe o nome do banco.';
    else if (bank.length > 60) errors.bank = 'O nome do banco deve ter no máximo 60 caracteres.';
    const annualRate = values.annualRate === '' ? NaN : parseDecimal(values.annualRate);
    if (!Number.isFinite(annualRate) || annualRate <= 0) {
      errors.annualRate = 'Informe a taxa anual efetiva maior que zero (%).';
    } else if (annualRate > 100) {
      errors.annualRate = 'A taxa anual não pode passar de 100%.';
    }
    const trMonthly = values.trMonthly === '' ? NaN : parseDecimal(values.trMonthly);
    if (!Number.isFinite(trMonthly)) {
      errors.trMonthly = 'Informe a TR mensal (%).';
    } else if (trMonthly < 0 || trMonthly > 10) {
      errors.trMonthly = 'A TR mensal deve ficar entre 0% e 10%.';
    }
    const insuranceMonthly = parseBRLToNumber(values.insuranceMonthly);
    if (!Number.isFinite(insuranceMonthly) || insuranceMonthly < 0) {
      errors.insuranceMonthly = 'Informe o seguro mensal.';
    }
  }
  if (step === 2) {
    const parcelasTotais = parseIntStrict(values.parcelasTotais);
    if (!Number.isInteger(parcelasTotais) || parcelasTotais < 1 || parcelasTotais > 600) {
      errors.parcelasTotais = 'Informe o total de parcelas (entre 1 e 600).';
    }
    const saldoDevedor = parseBRLToNumber(values.saldoDevedor);
    if (!Number.isFinite(saldoDevedor) || saldoDevedor <= 0) {
      errors.saldoDevedor = 'Informe o saldo devedor.';
    }
    const proximaParcelaNumero = parseIntStrict(values.proximaParcelaNumero);
    if (!Number.isInteger(proximaParcelaNumero) || proximaParcelaNumero < 1) {
      errors.proximaParcelaNumero = 'Informe o número da próxima parcela.';
    } else if (Number.isInteger(parcelasTotais) && proximaParcelaNumero > parcelasTotais) {
      errors.proximaParcelaNumero = 'A próxima parcela não pode passar do total de parcelas.';
    }
    if (!isValidDateString(values.dataBase)) {
      errors.dataBase = 'Informe a data-base.';
    }
    const diaVencimento = parseIntStrict(values.diaVencimento);
    if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      errors.diaVencimento = 'Informe o dia do vencimento (entre 1 e 31).';
    }
  }
  return errors;
}

const STEP_TITLES = ['Sobre o financiamento', 'Saldo, prazo e parcela', 'Confira os dados', 'Criar meu financiamento'];

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={cn('h-1.5 rounded-full transition-colors', i + 1 === step ? 'w-6 bg-[#820AD1]' : 'w-3 bg-muted-foreground/25')}
        />
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-right tabular-nums">{value}</dd>
    </div>
  );
}

export function OnboardingWizard({ draft }: { draft: unknown }) {
  const router = useRouter();
  const initial = sanitizeDraft(draft);
  const [step, setStep] = useState(initial?.step ?? 1);
  const [values, setValues] = useState<MeuFinanciamentoDraftValues>(initial?.values ?? EMPTY_VALUES);
  const [attempted, setAttempted] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [needsUnlimited, setNeedsUnlimited] = useState(false);

  const set = (patch: Partial<MeuFinanciamentoDraftValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setSaveState('idle');
    setSaveError('');
    setCreateError('');
    setNeedsUnlimited(false);
  };

  const errors = fieldErrors(step, values);
  const hasErrors = Object.keys(errors).length > 0;

  const contractInput: CreateContractInput = useMemo(() => ({
    bank: values.bank.trim(),
    system: values.system,
    annualRate: parseDecimal(values.annualRate) / 100,
    trMonthly: parseDecimal(values.trMonthly) / 100,
    insuranceMonthly: parseBRLToNumber(values.insuranceMonthly),
    parcelasTotais: parseIntStrict(values.parcelasTotais),
    saldoDevedor: parseBRLToNumber(values.saldoDevedor),
    dataBase: values.dataBase,
    proximaParcelaNumero: parseIntStrict(values.proximaParcelaNumero),
    diaVencimento: parseIntStrict(values.diaVencimento),
  }), [values]);

  const parcelasRestantes = contractInput.parcelasTotais - contractInput.proximaParcelaNumero + 1;
  const estimativa = useMemo(() => {
    // A conferência (passo 3) é a fonte da estimativa; o passo 4 (criar) precisa
    // dela para decidir se o contrato pode ser criado, sem reprojetar no servidor.
    if (step !== 3 && step !== 4) return null;
    if (Object.keys(fieldErrors(1, values)).length > 0 || Object.keys(fieldErrors(2, values)).length > 0) {
      return { ok: false as const };
    }
    try {
      const result = simulate({
        system: values.system,
        bank: values.bank.trim(),
        principal: contractInput.saldoDevedor,
        months: parcelasRestantes,
        annualRate: contractInput.annualRate,
        trMonthly: contractInput.trMonthly,
        insuranceMonthly: contractInput.insuranceMonthly,
        insuranceSplit: INSURANCE_SPLIT,
      });
      const ultimaParcela = result.installments[result.installments.length - 1];
      // A data-base é a competência da próxima parcela: a última parcela do
      // contrato cai em dataBase + (parcelasTotais - proximaParcelaNumero)
      // meses (ex.: próxima 121 de 240 com data-base 2026-08 → jul/2036),
      // respeitando o dia do vencimento informado.
      const dia = parseIntStrict(values.diaVencimento);
      const ultimaData = addMonthsISO(
        values.dataBase,
        contractInput.parcelasTotais - contractInput.proximaParcelaNumero,
        Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : undefined,
      );
      return {
        ok: true as const,
        parcelaProxima: result.installments[0]?.parcela ?? null,
        meses: result.installments.length,
        ultimaData,
        saldoFinal: ultimaParcela?.saldo ?? 0,
      };
    } catch {
      return { ok: false as const };
    }
  }, [step, values, contractInput, parcelasRestantes]);

  async function persist(targetStep: number): Promise<boolean> {
    setSaveState('saving');
    setSaveError('');
    const payload: MeuFinanciamentoDraft = { step: targetStep, values };
    let result;
    try {
      result = await saveDraft(payload);
    } catch {
      // Sessão expirada (requireUser lança na action): não deixar o estado
      // 'saving' travar os botões nem sumir com o erro.
      setSaveState('idle');
      setSaveError('Sessão expirada, entre novamente');
      return false;
    }
    if ('error' in result) {
      setSaveState('idle');
      setSaveError(result.error);
      return false;
    }
    setSaveState('saved');
    return true;
  }

  function continuar() {
    if (hasErrors) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    const target = Math.min(TOTAL_STEPS, step + 1);
    if (step < TOTAL_STEPS) {
      void (async () => {
        await persist(target);
        setStep(target);
      })();
    }
  }

  function voltar() {
    setAttempted(false);
    setCreateError('');
    setNeedsUnlimited(false);
    setStep((current) => Math.max(1, current - 1));
  }

  async function criar() {
    setCreating(true);
    setCreateError('');
    setNeedsUnlimited(false);
    let result;
    try {
      result = await createContract(contractInput);
    } catch {
      // Sessão expirada (requireUser lança na action): a promise rejeitada não
      // pode deixar o botão preso em 'Criando...'.
      setCreating(false);
      setCreateError('Sessão expirada, entre novamente');
      return;
    }
    setCreating(false);
    if ('error' in result) {
      if (result.error === UNLIMITED_ERROR) {
        setNeedsUnlimited(true);
        return;
      }
      setCreateError(result.error);
      return;
    }
    // refresh refetcha a página e o layout: sem ele, o cache do router mantém o
    // layout antigo (menu "Meu financiamento") e a página no passo 4 do wizard.
    router.refresh();
  }

  const alertList = Object.values(errors);

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-muted-foreground">
              Passo {step} de {TOTAL_STEPS}
            </p>
            <StepDots step={step} />
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold">{STEP_TITLES[0]}</h2>
                <p className="text-sm text-muted-foreground">
                  Comece pelos dados do contrato: banco, sistema e taxas. Use as condições do seu financiamento atual.
                </p>
              </div>
              <FieldHelp htmlFor="bank" label="Banco" help="Nome do banco do seu financiamento (até 60 caracteres).">
                <Input
                  id="bank"
                  value={values.bank}
                  onChange={(e) => set({ bank: e.target.value })}
                  placeholder="Ex.: Caixa Econômica Federal"
                  aria-invalid={attempted && Boolean(errors.bank)}
                />
              </FieldHelp>
              <FieldHelp
                group
                htmlFor="sistema"
                label="Sistema"
                help="Sistema de amortização do contrato: PRICE tem parcelas constantes; SAC tem parcelas decrescentes."
              >
                <div className="flex h-8 items-center gap-2">
                  <Select
                    value={values.system}
                    onValueChange={(next) => {
                      if (next === 'PRICE' || next === 'SAC') set({ system: next });
                    }}
                  >
                    <SelectTrigger aria-label="Sistema" className="w-full">
                      <SelectValue>{values.system}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICE">PRICE</SelectItem>
                      <SelectItem value="SAC">SAC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FieldHelp>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldHelp
                  htmlFor="annualRate"
                  label="Taxa anual efetiva (%)"
                  help="Taxa de juros efetiva ao ano informada no contrato. Ex.: 10,5 para 10,5% a.a."
                >
                  <NumericInput
                    id="annualRate"
                    value={values.annualRate === '' ? undefined : parseDecimal(values.annualRate)}
                    parse={parseDecimal}
                    onValid={(v) => set({ annualRate: numberToPtBr(v) })}
                    aria-invalid={attempted && Boolean(errors.annualRate)}
                  />
                </FieldHelp>
                <FieldHelp
                  htmlFor="trMonthly"
                  label="TR mensal (%)"
                  help="Correção monetária mensal do contrato (Taxa Referencial). Ex.: 0,17 para 0,17% a.m."
                >
                  <NumericInput
                    id="trMonthly"
                    value={values.trMonthly === '' ? undefined : parseDecimal(values.trMonthly)}
                    parse={parseDecimal}
                    onValid={(v) => set({ trMonthly: numberToPtBr(v) })}
                    aria-invalid={attempted && Boolean(errors.trMonthly)}
                  />
                </FieldHelp>
              </div>
              <FieldHelp
                htmlFor="insuranceMonthly"
                label="Seguro mensal (R$)"
                help="Soma dos seguros (MIP, DFI e residencial) cobrados em cada parcela, em reais."
              >
                <MoneyInput
                  id="insuranceMonthly"
                  value={parseBRLToNumber(values.insuranceMonthly)}
                  onValid={(v) => set({ insuranceMonthly: numberToBRLInput(v) })}
                  aria-invalid={attempted && Boolean(errors.insuranceMonthly)}
                />
              </FieldHelp>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold">{STEP_TITLES[1]}</h2>
                <p className="text-sm text-muted-foreground">
                  Informe o saldo devedor e a competência da próxima parcela conforme o seu boleto.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldHelp
                  htmlFor="parcelasTotais"
                  label="Total de parcelas"
                  help="Quantidade total de parcelas do contrato, da primeira até a última competência."
                >
                  <NumericInput
                    id="parcelasTotais"
                    value={values.parcelasTotais === '' ? undefined : parseIntStrict(values.parcelasTotais)}
                    parse={parseIntStrict}
                    onValid={(v) => set({ parcelasTotais: String(v) })}
                    aria-invalid={attempted && Boolean(errors.parcelasTotais)}
                  />
                </FieldHelp>
                <FieldHelp
                  htmlFor="proximaParcelaNumero"
                  label="Número da próxima parcela"
                  help="Número da competência ainda não paga (ex.: 145 se já pagou até a parcela 144)."
                >
                  <NumericInput
                    id="proximaParcelaNumero"
                    value={values.proximaParcelaNumero === '' ? undefined : parseIntStrict(values.proximaParcelaNumero)}
                    parse={parseIntStrict}
                    onValid={(v) => set({ proximaParcelaNumero: String(v) })}
                    aria-invalid={attempted && Boolean(errors.proximaParcelaNumero)}
                  />
                </FieldHelp>
              </div>
              <FieldHelp
                htmlFor="saldoDevedor"
                label="Saldo devedor (R$)"
                help="Saldo devedor atual do financiamento, informado no boleto ou no extrato do banco."
              >
                <MoneyInput
                  id="saldoDevedor"
                  value={parseBRLToNumber(values.saldoDevedor)}
                  onValid={(v) => set({ saldoDevedor: numberToBRLInput(v) })}
                  aria-invalid={attempted && Boolean(errors.saldoDevedor)}
                />
              </FieldHelp>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldHelp
                  htmlFor="dataBase"
                  label="Data-base"
                  help="Competência da próxima parcela, no formato dia/mês/ano. Ex.: 01/08/2026."
                >
                  <Input
                    id="dataBase"
                    type="date"
                    value={values.dataBase}
                    onChange={(e) => {
                      const dataBase = e.target.value;
                      // Default = dia da data-base digitada; preserva o dia que
                      // o usuário ajustou à mão (diferente do anterior).
                      const anterior = diaDaData(values.dataBase);
                      const manter = values.diaVencimento !== '' && values.diaVencimento !== anterior;
                      set({
                        dataBase,
                        diaVencimento: manter ? values.diaVencimento : diaDaData(dataBase),
                      });
                    }}
                    aria-invalid={attempted && Boolean(errors.dataBase)}
                  />
                </FieldHelp>
                <FieldHelp
                  htmlFor="diaVencimento"
                  label="Dia do vencimento"
                  help="Dia do mês em que a parcela vence (1 a 31). Quando o mês não tem o dia, vale o último dia dele."
                >
                  <NumericInput
                    id="diaVencimento"
                    value={values.diaVencimento === '' ? undefined : parseIntStrict(values.diaVencimento)}
                    parse={parseIntStrict}
                    onValid={(v) => set({ diaVencimento: String(v) })}
                    aria-invalid={attempted && Boolean(errors.diaVencimento)}
                  />
                </FieldHelp>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold">{STEP_TITLES[2]}</h2>
                <p className="text-sm text-muted-foreground">
                  Revise os dados e veja a projeção estimada do seu contrato antes de criar.
                </p>
              </div>
              <dl className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
                <SummaryRow label="Banco" value={values.bank.trim()} />
                <SummaryRow label="Sistema" value={values.system} />
                <SummaryRow
                  label="Taxa anual efetiva"
                  value={`${formatDecimalPtBr(parseDecimal(values.annualRate))}% a.a.`}
                />
                <SummaryRow label="TR mensal" value={`${formatDecimalPtBr(parseDecimal(values.trMonthly))}% a.m.`} />
                <SummaryRow label="Seguro mensal" value={formatBRL(parseBRLToNumber(values.insuranceMonthly))} />
                <SummaryRow
                  label="Saldo devedor"
                  value={formatBRL(parseBRLToNumber(values.saldoDevedor))}
                />
                <SummaryRow
                  label="Número da próxima parcela"
                  value={`${parseIntStrict(values.proximaParcelaNumero)} de ${parseIntStrict(values.parcelasTotais)}`}
                />
                <SummaryRow label="Data-base" value={formatDataBr(values.dataBase)} />
                <SummaryRow label="Dia do vencimento" value={String(parseIntStrict(values.diaVencimento))} />
              </dl>

              {estimativa?.ok ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Parcela estimada da parcela {parseIntStrict(values.proximaParcelaNumero)}
                    </p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                      {estimativa.parcelaProxima != null ? formatBRL(estimativa.parcelaProxima) : 'Indisponível'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Quitação estimada</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                      {estimativa.meses} {estimativa.meses === 1 ? 'parcela' : 'parcelas'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      até a parcela {parseIntStrict(values.parcelasTotais)} em {formatMesAno(estimativa.ultimaData)}
                    </p>
                  </div>
                </div>
              ) : (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível projetar o contrato com os dados informados. Revise os passos anteriores.
                </p>
              )}
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Estimativa do modelo. Confira com o seu boleto.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold">{STEP_TITLES[3]}</h2>
                <p className="text-sm text-muted-foreground">
                  Ao criar, seu financiamento fica registrado e você passa a acompanhar saldo, parcelas pagas, amortizações e recalibrações por aqui.
                </p>
              </div>
              <p className="flex items-center gap-2 rounded-lg bg-[#820AD1]/10 p-3 text-sm text-[#820AD1]">
                <Lock className="size-4 shrink-0" />
                Registrar e acompanhar o financiamento é exclusivo do plano Ilimitado.
              </p>
              {needsUnlimited && (
                <UpgradeCard
                  title="Crie seu financiamento com o plano Ilimitado"
                  subtitle="O recurso Meu financiamento é exclusivo do plano Ilimitado. Assine para registrar seu contrato e acompanhar a projeção."
                  bullets={[
                    'Acompanhe saldo, parcelas e amortizações do seu contrato real',
                    'Projeção e recomendações explicadas com os seus dados',
                  ]}
                />
              )}
              {createError && (
                <p role="alert" className="text-sm text-destructive">
                  {createError}
                </p>
              )}
              {!estimativa?.ok && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível projetar o contrato com os dados informados. Volte à conferência e revise taxa, TR e
                  prazo antes de criar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {attempted && alertList.length > 0 && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Revise os campos abaixo antes de continuar.</p>
            <ul className="mt-1 list-inside list-disc">
              {alertList.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={voltar}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
            )}
            {step < TOTAL_STEPS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saveState === 'saving'}
                onClick={() => {
                  void (async () => {
                    await persist(step);
                  })();
                }}
              >
                <Save className="size-3.5" />
                Salvar rascunho
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saveState === 'saving' && (
              <p role="status" className="text-xs text-muted-foreground">
                Salvando rascunho...
              </p>
            )}
            {saveState === 'saved' && (
              <p role="status" className="text-xs text-muted-foreground">
                Rascunho salvo
              </p>
            )}
            {saveError && (
              <p role="alert" className="text-xs text-destructive">
                {saveError}
              </p>
            )}
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={continuar} disabled={saveState === 'saving'}>
                Continuar
              </Button>
            ) : (
              <Button type="button" onClick={criar} disabled={creating || !estimativa?.ok}>
                <Zap className="size-4" />
                {creating ? 'Criando...' : 'Criar meu financiamento'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDecimalPtBr(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 1000) / 1000).replace('.', ',');
}
