'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Sparkles, Lock } from 'lucide-react';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';
import {
  comparePortability,
  portabilityBreakEven,
  safeDisplayedPortabilityRate,
  type PortabilityBreakEven,
  type PortabilityInput,
  type PortabilityResult,
} from '@/lib/finance/portability';
import type { AmortSystem } from '@/lib/finance/types';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { PortabilitySandbox } from './PortabilitySandbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RateField } from '@/components/ui/rate-field';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { normalizeRate, type RateKind } from '@/lib/finance/rates';

type SectionKey = 'data' | 'current' | 'offered' | 'smart';

type SmartBreakEven = PortabilityBreakEven & {
  worthwhileApplyRate: number | null;
  targetApplyRate: number | null;
};

const DEFAULTS = {
  principal: '800000',
  currentSystem: 'PRICE' as AmortSystem,
  currentAnnualRate: '11.5',
  currentAnnualRateKind: 'effective-annual' as RateKind,
  trMonthly: '0.17',
  insuranceMonthly: '100',
  months: '300',
  bank: 'Caixa',
  newSystem: 'PRICE' as AmortSystem,
  newAnnualRate: '9',
  newAnnualRateKind: 'effective-annual' as RateKind,
  newInsuranceMonthly: '100',
  newBank: 'Itaú',
  costs: '0',
  smartMode: false,
  targetParcela: '',
  smartResult: null as SmartBreakEven | null,
};

type Validation =
  | { ok: true; input: PortabilityInput; targetParcela?: number }
  | { ok: false; section: SectionKey; message: string };

type FormField = Exclude<keyof typeof DEFAULTS, 'smartResult'>;

export function PortabilityCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const [f, setF] = useState(DEFAULTS);
  const [result, setResult] = useState<PortabilityResult | null>(null);
  const [resultDirty, setResultDirty] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [actionError, setActionError] = useState('');
  const [monthsValid, setMonthsValid] = useState(true);
  const [trValid, setTrValid] = useState(true);
  const [currentRateValid, setCurrentRateValid] = useState(true);
  const [newRateValid, setNewRateValid] = useState(true);
  const monthsValidRef = useRef(true);
  const trValidRef = useRef(true);
  const currentRateValidRef = useRef(true);
  const newRateValidRef = useRef(true);

  const setForm = <K extends FormField>(k: K, v: (typeof DEFAULTS)[K]) => {
    setF((p) => ({ ...p, [k]: v, smartResult: null }));
    if (result !== null) setResultDirty(true);
  };

  // Auto-save: cada comparação calculada é salva automaticamente em
  // "Minhas simulações" (recurso Ilimitado, sem custo). O fingerprint evita
  // duplicar em reload; recalcular com valores diferentes salva de novo.
  const portSavedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result) return;
    if (portSavedFpRef.current === null) {
      portSavedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('portability-saved-fp');
    }
    const fp = JSON.stringify({ f, result: result.economiaLiquida });
    if (portSavedFpRef.current === fp) return;
    portSavedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('portability-saved-fp', fp);
    }
    (async () => {
      await saveToolSimulation({
        name: `Portabilidade ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Portabilidade',
        payload: { form: f },
        result,
        charge: false,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const setSmart = (smartResult: SmartBreakEven | null) => setF((p) => ({ ...p, smartResult }));

  const setFieldValidity = (
    validRef: React.RefObject<boolean>,
    setValid: (valid: boolean) => void,
    valid: boolean
  ) => {
    validRef.current = valid;
    setValid(valid);
    if (!valid) {
      setSmart(null);
      if (result !== null) setResultDirty(true);
    }
  };

  function validate(): Validation {
    const principal = parseBRLToNumber(f.principal);
    const currentAnnualRate = parseDecimal(f.currentAnnualRate);
    const newAnnualRate = parseDecimal(f.newAnnualRate);
    let currentEffectiveAnnual = NaN;
    let newEffectiveAnnual = NaN;
    try {
      currentEffectiveAnnual = normalizeRate(currentAnnualRate, f.currentAnnualRateKind).effectiveAnnual;
    } catch {
      // Erro apresentado na seção do campo.
    }
    try {
      newEffectiveAnnual = normalizeRate(newAnnualRate, f.newAnnualRateKind).effectiveAnnual;
    } catch {
      // Erro apresentado na seção do campo.
    }
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const months = Number(f.months);
    const newInsuranceMonthly = parseBRLToNumber(f.newInsuranceMonthly);
    const costs = parseBRLToNumber(f.costs);
    const targetParcela = f.targetParcela === '' ? undefined : parseBRLToNumber(f.targetParcela);
    if (!(principal > 0)) return { ok: false, section: 'data', message: 'Informe o saldo devedor atual (maior que zero).' };
    if (!monthsValidRef.current || !monthsValid || !(Number.isInteger(months) && months >= 1 && months <= 600)) return { ok: false, section: 'data', message: 'Parcelas restantes entre 1 e 600.' };
    if (!trValidRef.current || !trValid || !(trMonthly >= 0)) return { ok: false, section: 'data', message: 'Informe uma TR mensal válida.' };
    if (trMonthly > 10) return { ok: false, section: 'data', message: 'A TR mensal deve ficar entre 0% e 10%.' };
    if (!currentRateValidRef.current || !currentRateValid || !(currentEffectiveAnnual >= 0 && currentEffectiveAnnual <= 1)) return { ok: false, section: 'current', message: 'Informe uma taxa atual válida.' };
    if (!newRateValidRef.current || !newRateValid || !(newEffectiveAnnual >= 0 && newEffectiveAnnual <= 1)) return { ok: false, section: 'offered', message: 'Informe uma nova taxa válida.' };
    if (!(insuranceMonthly >= 0)) return { ok: false, section: 'current', message: 'Informe o seguro atual válido.' };
    if (!(newInsuranceMonthly >= 0)) return { ok: false, section: 'offered', message: 'Informe o novo seguro válido.' };
    if (!(costs >= 0)) return { ok: false, section: 'offered', message: 'Custos não podem ser negativos.' };
    if (f.smartMode && targetParcela !== undefined && !(targetParcela > 0)) return { ok: false, section: 'smart', message: 'Informe uma parcela desejada maior que zero.' };
    return {
      ok: true,
      input: {
        principal,
        currentSystem: f.currentSystem,
        currentAnnualRate: currentEffectiveAnnual,
        trMonthly: trMonthly / 100,
        insuranceMonthly,
        months,
        bank: f.bank,
        newSystem: f.newSystem,
        newAnnualRate: newEffectiveAnnual,
        newInsuranceMonthly,
        newBank: f.newBank,
        costs,
      },
      targetParcela,
    };
  }

  function buscarTaxaIdeal() {
    setSectionErrors({});
    setActionError('');
    setSmart(null);
    const validation = validate();
    if (!validation.ok) {
      setSectionErrors({ [validation.section]: validation.message });
      return;
    }
    try {
      const input = { ...validation.input, newAnnualRate: validation.input.currentAnnualRate };
      const smartResult = portabilityBreakEven(input, validation.targetParcela);
      const combinedBoundary = (rate: number | null) =>
        rate === null || smartResult.maxWorthwhileRate === null
          ? null
          : Math.min(rate, smartResult.maxWorthwhileRate);
      setSmart({
        ...smartResult,
        worthwhileApplyRate: safeDisplayedPortabilityRate(
          input,
          combinedBoundary(smartResult.maxWorthwhileRate),
          validation.targetParcela
        ),
        targetApplyRate: safeDisplayedPortabilityRate(
          input,
          combinedBoundary(smartResult.targetParcela?.maxRate ?? null),
          validation.targetParcela
        ),
      });
    } catch (e) {
      setSectionErrors({ smart: e instanceof Error ? e.message : 'Não foi possível buscar a taxa ideal.' });
    }
  }

  function aplicarTaxa(rate: number | null) {
    if (rate === null) return;
    setForm('newAnnualRate', String(rate * 100));
    setForm('newAnnualRateKind', 'effective-annual');
    setNewRateValid(true);
    setSmart(null);
  }

  function calcular() {
    setSectionErrors({});
    setActionError('');
    const validation = validate();
    if (!validation.ok) {
      setSectionErrors({ [validation.section]: validation.message });
      return;
    }
    try {
      setResult(comparePortability(validation.input));
      setResultDirty(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Não foi possível calcular a portabilidade.');
    }
  }

  const outcome = result
    ? result.economiaLiquida > 0
      ? 'positive'
      : result.economiaLiquida < 0
        ? 'negative'
        : 'neutral'
    : null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Portabilidade <ArrowLeftRight className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Informe seu financiamento atual e a proposta do novo banco: veja se vale a pena portar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isUnlimited ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <Lock className="mx-auto size-8 text-[#820AD1]" />
            <p className="text-sm font-medium">Recurso exclusivo do plano Ilimitado</p>
            <p className="text-sm text-muted-foreground">
              Compare manter o contrato com portar para um novo banco.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mx-auto"
              onClick={() => setUpgradeOpen(true)}
            >
              <Lock className="size-3" /> Ver opções de acesso
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <section
              aria-label="Dados do financiamento"
              className="flex flex-col gap-4 rounded-2xl border border-muted-foreground/40 bg-card p-4 sm:p-5"
            >
              <h2 className="text-sm font-semibold">Dados do financiamento</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FieldHelp htmlFor="portPrincipal" label="Saldo devedor atual (R$)" help="Valor ainda devido hoje, disponível no extrato ou demonstrativo do financiamento; não use o valor original do contrato.">
                  <MoneyInput id="portPrincipal" aria-describedby="portPrincipal-help" value={parseBRLToNumber(f.principal)} onValid={(v) => setForm('principal', numberToBRLInput(v))} />
                </FieldHelp>
                <FieldHelp htmlFor="portMonths" label="Parcelas restantes" help="Quantidade de prestações que faltam no contrato atual, conforme o extrato mais recente.">
                  <NumericInput id="portMonths" aria-describedby="portMonths-help" value={Number(f.months)} parse={parseIntStrict} onValid={(v) => setForm('months', String(v))} onValidityChange={(valid) => setFieldValidity(monthsValidRef, setMonthsValid, valid)} />
                </FieldHelp>
                <FieldHelp htmlFor="portTr" label="TR mensal (%)" help="Correção monetária mensal do contrato, separada dos juros. Consulte o extrato; use zero quando não houver TR.">
                  <NumericInput id="portTr" aria-describedby="portTr-help" value={parseDecimal(f.trMonthly)} parse={parseDecimal} onValid={(v) => setForm('trMonthly', String(v))} onValidityChange={(valid) => setFieldValidity(trValidRef, setTrValid, valid)} />
                </FieldHelp>
              </div>
              {sectionErrors.data && (
                <p role="alert" className="text-sm text-destructive">
                  {sectionErrors.data}
                </p>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section
                aria-label="Contrato atual"
                className="flex flex-col gap-4 rounded-2xl border border-muted-foreground/40 bg-card p-4 sm:p-5"
              >
                <h2 className="text-sm font-semibold">Contrato atual</h2>
                <FieldHelp htmlFor="portBank" label="Banco atual" help="Instituição onde o financiamento está hoje; identifica o cenário que será mantido.">
                  <Select value={f.bank} onValueChange={(v) => setForm('bank', String(v))}>
                    <SelectTrigger id="portBank" aria-describedby="portBank-help" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldHelp>
                <FieldHelp htmlFor="portCurrentSystem" label="Sistema atual" group help="Escolha PRICE se a parcela contratual é mais estável ou SAC se a amortização é fixa e a parcela cai.">
                  <RadioGroup
                    id="portCurrentSystem-rg"
                    data-field-help-id="portCurrentSystem"
                    aria-describedby="portCurrentSystem-help"
                    value={f.currentSystem}
                    onValueChange={(v) => setForm('currentSystem', v as AmortSystem)}
                    className="flex flex-row gap-4"
                  >
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="PRICE" /> PRICE
                    </Label>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="SAC" /> SAC
                    </Label>
                  </RadioGroup>
                </FieldHelp>
                <RateField
                  id="portCurrentRate"
                  label="Taxa atual"
                  value={parseDecimal(f.currentAnnualRate)}
                  kind={f.currentAnnualRateKind}
                  onValueChange={(v) => setForm('currentAnnualRate', String(v))}
                  onKindChange={(kind) => setForm('currentAnnualRateKind', kind)}
                  onValidityChange={(valid) => setFieldValidity(currentRateValidRef, setCurrentRateValid, valid)}
                  minEffectiveAnnual={0}
                />
                <FieldHelp htmlFor="portSeguro" label="Seguro atual (R$/mês)" help="Soma mensal dos seguros cobrada na prestação atual, encontrada no extrato do financiamento.">
                  <MoneyInput id="portSeguro" aria-describedby="portSeguro-help" value={parseBRLToNumber(f.insuranceMonthly)} onValid={(v) => setForm('insuranceMonthly', numberToBRLInput(v))} />
                </FieldHelp>
                {sectionErrors.current && (
                  <p role="alert" className="text-sm text-destructive">
                    {sectionErrors.current}
                  </p>
                )}
              </section>

              <section
                aria-label="Proposta oferecida"
                className="flex flex-col gap-4 rounded-2xl border border-muted-foreground/40 bg-primary/[0.03] p-4 sm:p-5"
              >
                <h2 className="text-sm font-semibold">Proposta oferecida</h2>
                <FieldHelp htmlFor="portNewBank" label="Novo banco" help="Instituição que fez a oferta de portabilidade; identifica o novo cenário.">
                  <Select value={f.newBank} onValueChange={(v) => setForm('newBank', String(v))}>
                    <SelectTrigger id="portNewBank" aria-describedby="portNewBank-help" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldHelp>
                <FieldHelp htmlFor="portNewSystem" label="Novo sistema" group help="Sistema de amortização da proposta oferecida. Trocar PRICE por SAC muda a evolução das parcelas e dos juros.">
                  <RadioGroup
                    id="portNewSystem-rg"
                    data-field-help-id="portNewSystem"
                    aria-describedby="portNewSystem-help"
                    value={f.newSystem}
                    onValueChange={(v) => setForm('newSystem', v as AmortSystem)}
                    className="flex flex-row gap-4"
                  >
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="PRICE" /> PRICE
                    </Label>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="SAC" /> SAC
                    </Label>
                  </RadioGroup>
                </FieldHelp>
                <RateField
                  id="portNewRate"
                  label="Nova taxa"
                  value={parseDecimal(f.newAnnualRate)}
                  kind={f.newAnnualRateKind}
                  onValueChange={(v) => setForm('newAnnualRate', String(v))}
                  onKindChange={(kind) => setForm('newAnnualRateKind', kind)}
                  onValidityChange={(valid) => setFieldValidity(newRateValidRef, setNewRateValid, valid)}
                  minEffectiveAnnual={0}
                />
                <FieldHelp htmlFor="portNewSeguro" label="Novo seguro (R$/mês)" help="Seguro mensal informado na proposta oferecida; entra na comparação de todas as parcelas.">
                  <MoneyInput id="portNewSeguro" aria-describedby="portNewSeguro-help" value={parseBRLToNumber(f.newInsuranceMonthly)} onValid={(v) => setForm('newInsuranceMonthly', numberToBRLInput(v))} />
                </FieldHelp>
                <FieldHelp htmlFor="portCosts" label="Custos da portabilidade (R$)" help="Some avaliação, cartório e tarifas não financiadas. Esses custos reduzem a economia líquida da troca.">
                  <MoneyInput id="portCosts" aria-describedby="portCosts-help" value={parseBRLToNumber(f.costs)} onValid={(v) => setForm('costs', numberToBRLInput(v))} />
                </FieldHelp>
                {sectionErrors.offered && (
                  <p role="alert" className="text-sm text-destructive">
                    {sectionErrors.offered}
                  </p>
                )}
              </section>
            </div>

            <section aria-label="Busca inteligente" className="flex flex-col gap-3 rounded-2xl border border-muted-foreground/40 bg-muted/50 p-4">
              <h2 className="text-sm font-semibold">Busca inteligente</h2>
              <FieldHelp htmlFor="portSmartMode" label="Busca inteligente" help="Ative para calcular a maior taxa da nova proposta que ainda gera economia após os custos da portabilidade.">
                <Switch
                  id="portSmartMode"
                  data-field-help-id="portSmartMode"
                  aria-describedby="portSmartMode-help"
                  checked={f.smartMode}
                  onCheckedChange={(v) => {
                    setForm('smartMode', v);
                    setSectionErrors((p) => ({ ...p, smart: undefined }));
                  }}
                />
              </FieldHelp>
              <p className="text-xs text-muted-foreground">
                Não sabe qual taxa pedir? Diga até quanto quer de parcela (ou use só o limite de
                compensação) e descubra a taxa máxima que o novo banco pode cobrar pra ainda valer
                a pena portar.
              </p>
              {f.smartMode && (
                <div className="flex flex-col gap-3">
                  <div className="sm:max-w-60">
                    <FieldHelp htmlFor="portTarget" label="Parcela desejada (R$, opcional)" help="Teto de parcela que você quer na nova proposta; a busca mostra a taxa máxima que respeita esse valor.">
                    <MoneyInput
                      id="portTarget"
                      aria-describedby="portTarget-help"
                      value={f.targetParcela ? parseBRLToNumber(f.targetParcela) : 0}
                      onValid={(v) => setForm('targetParcela', v === 0 ? '' : numberToBRLInput(v))}
                    />
                    </FieldHelp>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={buscarTaxaIdeal}>
                      <Sparkles className="size-3.5" /> Buscar taxa ideal
                    </Button>
                  </div>
                  {sectionErrors.smart && (
                    <p role="alert" className="text-sm text-destructive">
                      {sectionErrors.smart}
                    </p>
                  )}
                  {f.smartResult && (
                    <div className="flex flex-col gap-2 rounded-xl border border-muted-foreground/40 bg-muted p-3 text-xs">
                      {f.smartResult.maxWorthwhileRate !== null ? (
                        <p>
                          <strong>Taxa máxima que ainda compensa portar:</strong>{' '}
                          {f.smartResult.worthwhileApplyRate === 1
                            ? '100,00% a.a., teto do domínio'
                            : `${((f.smartResult.worthwhileApplyRate ?? f.smartResult.maxWorthwhileRate) * 100).toFixed(2)}% a.a.`}{' '}
                          <span className="text-muted-foreground">
                            {f.smartResult.worthwhileApplyRate === 1
                              ? ' (a busca não extrapola o máximo aceito pelo motor)'
                              : ' (com taxa acima disso, portar sai mais caro que manter)'}
                          </span>{' '}
                          {f.smartResult.worthwhileApplyRate !== null && <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-[#820AD1]"
                            onClick={() => aplicarTaxa(f.smartResult!.worthwhileApplyRate)}
                          >
                            Aplicar
                          </Button>}
                        </p>
                      ) : (
                        <p className="text-amber-700 dark:text-amber-400">
                          <strong>Sem taxa viável:</strong> nem com taxa 0% a portabilidade
                          compensa após os custos da troca.
                        </p>
                      )}
                      {f.smartResult.targetParcela !== null &&
                        (f.smartResult.targetParcela.maxRate === null ? (
                          <p className="text-amber-700 dark:text-amber-400">
                            <strong>Parcela desejada impossível:</strong> nem com taxa 0% dá para
                            chegar nesse valor.
                          </p>
                        ) : f.smartResult.targetApplyRate !== null ? (
                          <p>
                            <strong>Taxa necessária para a sua parcela desejada:</strong>{' '}
                            {f.smartResult.targetApplyRate === 1
                              ? '100,00% a.a., teto do domínio'
                              : `${(f.smartResult.targetApplyRate * 100).toFixed(2)}% a.a.`}{' '}
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs text-[#820AD1]"
                              onClick={() => aplicarTaxa(f.smartResult!.targetApplyRate)}
                            >
                              Aplicar
                            </Button>
                          </p>
                        ) : (
                          <p className="text-amber-700 dark:text-amber-400">
                            <strong>Sem taxa combinada viável:</strong> a parcela desejada é
                            alcançável, mas nenhuma taxa também compensa portar.
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="flex flex-col items-end gap-2">
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
              <Button type="button" onClick={calcular}>
                <ArrowLeftRight className="size-4" /> Comparar contrato atual e proposta
              </Button>
            </div>

            {result && (
              <div className="flex min-w-0 flex-col gap-4">
                {resultDirty && (
                  <p
                    role="alert"
                    className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    Dados alterados, calcule novamente
                  </p>
                )}
                <div
                  className={`rounded-xl p-4 text-sm ${
                    outcome === 'positive'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : outcome === 'negative'
                        ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        : 'bg-muted text-foreground'
                  }`}
                >
                  {outcome === 'positive' ? (
                    <>
                      <p>
                        <strong>Vale a pena portar!</strong> A economia líquida total é de{' '}
                        <strong>{formatBRL(result.economiaLiquida)}</strong>.
                      </p>
                      <p className="mt-1">
                        {result.costs > 0 && result.paybackMonth !== null
                          ? `A economia acumulada cobre os custos da portabilidade em ${result.paybackMonth} ${result.paybackMonth === 1 ? 'mês' : 'meses'} (${(result.paybackMonth / 12).toFixed(1)} anos).`
                          : result.costs > 0
                            ? 'Custos não recuperados no prazo.'
                            : null}
                      </p>
                      <p className="mt-1">
                        {(result.ported.installments[0]?.parcela ?? 0) < (result.keep.installments[0]?.parcela ?? 0)
                          ? 'A primeira parcela fica menor que a atual.'
                          : (result.ported.installments[0]?.parcela ?? 0) > (result.keep.installments[0]?.parcela ?? 0)
                            ? 'A primeira parcela fica maior que a atual, apesar da economia total.'
                            : 'A primeira parcela fica igual à atual.'}
                      </p>
                    </>
                  ) : outcome === 'negative' ? (
                    <p>
                      <strong>Não vale a pena portar.</strong> Manter o contrato atual é{' '}
                      <strong>{formatBRL(-result.economiaLiquida)}</strong> mais barato que portar.
                    </p>
                  ) : (
                    <p>Empate: manter e portar têm o mesmo custo total.</p>
                  )}
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                    <span className="text-xs text-muted-foreground">Economia bruta</span>
                    <span className="text-lg font-semibold">{formatBRL(result.economiaBruta)}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                    <span className="text-xs text-muted-foreground">Custos</span>
                    <span className="text-lg font-semibold">{formatBRL(result.costs)}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                    <span className="text-xs text-muted-foreground">Economia líquida</span>
                    <span
                      className={`text-lg font-semibold ${
                        outcome === 'positive'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : outcome === 'negative'
                            ? 'text-destructive'
                            : ''
                      }`}
                    >
                      {formatBRL(outcome === 'neutral' ? 0 : result.economiaLiquida)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                    <span className="text-xs text-muted-foreground">Payback dos custos</span>
                    <span className="text-lg font-semibold">
                      {result.paybackMonth !== null
                        ? `${result.paybackMonth} ${result.paybackMonth === 1 ? 'mês' : 'meses'}`
                        : result.costs > 0
                          ? 'custos não recuperados no prazo'
                          : 'não se aplica'}
                    </span>
                  </div>
                </div>
                <div className="grid min-w-0 gap-3 md:grid-cols-2">
                  <section
                    aria-label="Resultado do contrato atual"
                    className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-muted-foreground/40 bg-card p-4 [overflow-wrap:anywhere]"
                  >
                    <h3 className="text-sm font-semibold">Contrato atual</h3>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Parcela inicial</span>
                        <span className="text-lg font-semibold">
                          {formatBRL(result.keep.installments[0]?.parcela ?? 0)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          mês 1
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Maior parcela</span>
                        <span className="text-lg font-semibold">
                          {formatBRL(Math.max(...result.keep.installments.map((item) => item.parcela), 0))}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Total futuro das parcelas</span>
                        <span className="text-lg font-semibold">
                          {formatBRL(result.keep.metrics.totalPago)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Juros totais</span>
                        <span className="text-lg font-semibold">{formatBRL(result.keep.metrics.totalJuros)}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Prazo restante</span>
                        <span className="text-lg font-semibold">{result.keep.metrics.saldoZeroAt} meses</span>
                      </div>
                    </div>
                  </section>
                  <section
                    aria-label="Resultado da proposta oferecida"
                    className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-muted-foreground/40 bg-primary/[0.03] p-4 [overflow-wrap:anywhere]"
                  >
                    <h3 className="text-sm font-semibold">Proposta oferecida</h3>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Parcela inicial</span>
                        <span
                          className={`text-lg font-semibold ${
                            (result.keep.installments[0]?.parcela ?? 0) >
                            (result.ported.installments[0]?.parcela ?? 0)
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-destructive'
                          }`}
                        >
                          {formatBRL(result.ported.installments[0]?.parcela ?? 0)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          mês 1
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Maior parcela</span>
                        <span className="text-lg font-semibold">
                          {formatBRL(Math.max(...result.ported.installments.map((item) => item.parcela), 0))}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Total futuro das parcelas</span>
                        <span className="text-lg font-semibold">{formatBRL(result.ported.metrics.totalPago)}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Custos da portabilidade</span>
                        <span className="text-lg font-semibold">{formatBRL(result.costs)}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Total futuro combinado</span>
                        <span className="text-lg font-semibold">
                          {formatBRL(result.ported.metrics.totalPago + result.costs)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Juros totais</span>
                        <span className="text-lg font-semibold">{formatBRL(result.ported.metrics.totalJuros)}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">Prazo proposto</span>
                        <span className="text-lg font-semibold">{result.ported.metrics.saldoZeroAt} meses</span>
                      </div>
                    </div>
                  </section>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resultDirty}
                    onClick={() => setShowSandbox((v) => !v)}
                  >
                    {showSandbox ? 'Ocultar comparação' : 'Ver comparação lado a lado'}
                  </Button>
                </div>
              </div>
            )}

            {result && showSandbox && (
              <PortabilitySandbox
                keep={result.keep}
                ported={result.ported}
                keepTitle={`Manter no ${result.keep.input.bank} (${result.keep.input.system})`}
                portedTitle={`Portar para ${result.ported.input.bank} (${result.ported.input.system} a ${(result.ported.input.annualRate * 100).toFixed(2).replace('.', ',')}% a.a. efetivos)`}
                costs={result.costs}
                economiaLiquida={result.economiaLiquida}
                disabled={resultDirty}
              />
            )}
          </div>
        )}
      </CardContent>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Card>
  );
}
