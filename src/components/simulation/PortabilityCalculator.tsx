'use client';

import { useState } from 'react';
import { ArrowLeftRight, Sparkles } from 'lucide-react';
import { comparePortability, portabilityBreakEven, type PortabilityResult } from '@/lib/finance/portability';
import type { AmortSystem } from '@/lib/finance/types';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { PortabilitySandbox } from './PortabilitySandbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

type SmartBreakEven = { maxWorthwhileRate: number; maxRateForTargetParcela: number | null };

const DEFAULTS = {
  principal: '800000',
  currentSystem: 'PRICE' as AmortSystem,
  currentAnnualRate: '11.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  months: '300',
  bank: 'Caixa',
  newSystem: 'PRICE' as AmortSystem,
  newAnnualRate: '9',
  newInsuranceMonthly: '100',
  newBank: 'Itaú',
  costs: '0',
  smartMode: false,
  targetParcela: '',
  smartResult: null as SmartBreakEven | null,
};

export function PortabilityCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const [f, setF] = useState(DEFAULTS);
  const [result, setResult] = useState<PortabilityResult | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function buscarTaxaIdeal() {
    setError('');
    const principal = parseBRLToNumber(f.principal);
    const currentAnnualRate = parseDecimal(f.currentAnnualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const months = Number(f.months);
    const newInsuranceMonthly = parseBRLToNumber(f.newInsuranceMonthly);
    const targetParcela = f.targetParcela ? parseBRLToNumber(f.targetParcela) : undefined;
    if (!(principal > 0)) return setError('Informe o saldo devedor atual (maior que zero).');
    if (!(currentAnnualRate > 0)) return setError('Informe a taxa atual (maior que zero).');
    if (!(months >= 1 && months <= 600)) return setError('Parcelas restantes entre 1 e 600.');
    const be = portabilityBreakEven(
      {
        principal,
        currentSystem: f.currentSystem,
        currentAnnualRate: currentAnnualRate / 100,
        trMonthly: trMonthly / 100,
        insuranceMonthly,
        months,
        bank: f.bank,
        newSystem: f.newSystem,
        newAnnualRate: currentAnnualRate / 100,
        newInsuranceMonthly,
        newBank: f.newBank,
        costs: parseBRLToNumber(f.costs),
      },
      targetParcela
    );
    set('smartResult', be);
  }

  function aplicarTaxa(rate: number) {
    set('newAnnualRate', String((rate * 100).toFixed(2)));
    set('smartResult', null);
    setResult(null);
  }

  function calcular() {
    setError('');
    setResult(null);
    const principal = parseBRLToNumber(f.principal);
    const currentAnnualRate = parseDecimal(f.currentAnnualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const months = Number(f.months);
    const newAnnualRate = parseDecimal(f.newAnnualRate);
    const newInsuranceMonthly = parseBRLToNumber(f.newInsuranceMonthly);
    const costs = parseBRLToNumber(f.costs);
    if (!(principal > 0)) return setError('Informe o saldo devedor atual (maior que zero).');
    if (!(currentAnnualRate > 0)) return setError('Informe a taxa atual (maior que zero).');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro atual válido.');
    if (!(months >= 1 && months <= 600)) return setError('Parcelas restantes entre 1 e 600.');
    if (!(newAnnualRate > 0)) return setError('Informe a nova taxa (maior que zero).');
    if (!(newInsuranceMonthly >= 0)) return setError('Informe o novo seguro válido.');
    if (!(costs >= 0)) return setError('Custos não podem ser negativos.');

    const r = comparePortability({
      principal,
      currentSystem: f.currentSystem,
      currentAnnualRate: currentAnnualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      months,
      bank: f.bank,
      newSystem: f.newSystem,
      newAnnualRate: newAnnualRate / 100,
      newInsuranceMonthly,
      newBank: f.newBank,
      costs,
    });
    setResult(r);
  }

  const vantajoso = (result?.economia ?? 0) > 0;

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
            <ArrowLeftRight className="mx-auto size-8 text-[#820AD1]" />
            <p className="text-sm text-muted-foreground">
              Recurso exclusivo do plano Ilimitado.
            </p>
            <Badge variant="secondary" className="mx-auto text-xs">
              Exclusivo Ilimitado
            </Badge>
            <Link href="/planos" className="mx-auto text-sm font-medium text-[#820AD1]">
              Ver planos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portPrincipal">Saldo devedor atual (R$)</Label>
                <NumericInput id="portPrincipal" value={parseBRLToNumber(f.principal)} parse={parseBRLToNumber} onValid={(v) => set("principal", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portMonths">Parcelas restantes</Label>
                <NumericInput id="portMonths" value={Number(f.months)} parse={parseIntStrict} onValid={(v) => set("months", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portCurrentRate">Taxa atual a.a. (%)</Label>
                <NumericInput id="portCurrentRate" value={parseDecimal(f.currentAnnualRate)} parse={parseDecimal} onValid={(v) => set("currentAnnualRate", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portTr">TR mensal (%)</Label>
                <NumericInput id="portTr" value={parseDecimal(f.trMonthly)} parse={parseDecimal} onValid={(v) => set("trMonthly", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portSeguro">Seguro atual (R$/mês)</Label>
                <NumericInput id="portSeguro" value={parseBRLToNumber(f.insuranceMonthly)} parse={parseBRLToNumber} onValid={(v) => set("insuranceMonthly", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Banco atual</Label>
                <Select value={f.bank} onValueChange={(v) => set('bank', String(v))}>
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Sistema atual</Label>
                <RadioGroup
                  value={f.currentSystem}
                  onValueChange={(v) => set('currentSystem', v as AmortSystem)}
                  className="flex flex-row gap-4"
                >
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PRICE" /> PRICE
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="SAC" /> SAC
                  </Label>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portNewRate">Nova taxa a.a. (%)</Label>
                <NumericInput id="portNewRate" value={parseDecimal(f.newAnnualRate)} parse={parseDecimal} onValid={(v) => set("newAnnualRate", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portNewSeguro">Novo seguro (R$/mês)</Label>
                <NumericInput id="portNewSeguro" value={parseBRLToNumber(f.newInsuranceMonthly)} parse={parseBRLToNumber} onValid={(v) => set("newInsuranceMonthly", String(v))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Novo banco</Label>
                <Select value={f.newBank} onValueChange={(v) => set('newBank', String(v))}>
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portNewSystem">Novo sistema</Label>
                <RadioGroup
                  value={f.newSystem}
                  onValueChange={(v) => set('newSystem', v as AmortSystem)}
                  className="flex flex-row gap-4"
                >
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PRICE" /> PRICE
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="SAC" /> SAC
                  </Label>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portCosts">Custos da portabilidade (R$)</Label>
                <NumericInput id="portCosts" value={parseBRLToNumber(f.costs)} parse={parseBRLToNumber} onValid={(v) => set("costs", String(v))} />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-4">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={f.smartMode}
                  onCheckedChange={(v) => set('smartMode', v)}
                />
                Busca inteligente
              </Label>
              <p className="text-xs text-muted-foreground">
                Não sabe qual taxa pedir? Diga até quanto quer de parcela (ou use só o limite de
                compensação) e descubra a taxa máxima que o novo banco pode cobrar pra ainda valer
                a pena portar.
              </p>
              {f.smartMode && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5 sm:max-w-60">
                    <Label htmlFor="portTarget">Parcela desejada (R$, opcional)</Label>
                    <NumericInput
                      id="portTarget"
                      value={f.targetParcela ? parseBRLToNumber(f.targetParcela) : undefined}
                      parse={parseBRLToNumber}
                      onValid={(v) => set('targetParcela', String(v))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={buscarTaxaIdeal}>
                      <Sparkles className="size-3.5" /> Buscar taxa ideal
                    </Button>
                  </div>
                  {f.smartResult && (
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3 text-xs">
                      <p>
                        <strong>Taxa máxima que ainda compensa portar:</strong>{' '}
                        {(f.smartResult.maxWorthwhileRate * 100).toFixed(2)}% a.a.{' '}
                        <span className="text-muted-foreground">
                          (com taxa acima disso, portar sai mais caro que manter)
                        </span>{' '}
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-[#820AD1]"
                          onClick={() => aplicarTaxa(f.smartResult!.maxWorthwhileRate)}
                        >
                          Aplicar
                        </Button>
                      </p>
                      {f.smartResult.maxRateForTargetParcela !== null ? (
                        <p>
                          <strong>Taxa necessária para a sua parcela desejada:</strong>{' '}
                          {(f.smartResult.maxRateForTargetParcela * 100).toFixed(2)}% a.a.{' '}
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-[#820AD1]"
                            onClick={() => aplicarTaxa(f.smartResult!.maxRateForTargetParcela!)}
                          >
                            Aplicar
                          </Button>
                        </p>
                      ) : (
                        <p className="text-amber-700">
                          <strong>Parcela desejada impossível:</strong> nem com taxa 0% dá para
                          chegar nesse valor.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={calcular}>
                <ArrowLeftRight className="size-4" /> Calcular portabilidade
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {result && (
              <div className="flex flex-col gap-4">
                <div
                  className={`rounded-xl p-4 text-sm ${
                    vantajoso ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {vantajoso ? (
                    <>
                      <strong>Vale a pena portar!</strong> Você economiza{' '}
                      <strong>{formatBRL(result.economia)}</strong> no total.
                      {parseBRLToNumber(f.costs) > 0 && result.paybackMonth
                        ? ` A economia acumulada cobre os custos da portabilidade em ${result.paybackMonth} ${result.paybackMonth === 1 ? 'mês' : 'meses'} (${(result.paybackMonth / 12).toFixed(1)} anos).`
                        : ' Sua parcela já cai a partir da primeira parcela.'}
                    </>
                  ) : (
                    <>
                      <strong>Não vale a pena.</strong> Manter o contrato atual é{' '}
                      <strong>{formatBRL(-result.economia)}</strong> mais barato que portar.
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Parcela atual</span>
                    <span className="text-lg font-semibold">
                      {formatBRL(result.keep.installments[0]?.parcela ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.keep.metrics.saldoZeroAt} meses restantes
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Parcela portada</span>
                    <span
                      className={`text-lg font-semibold ${
                        (result.keep.installments[0]?.parcela ?? 0) > (result.ported.installments[0]?.parcela ?? 0)
                          ? 'text-emerald-600'
                          : 'text-destructive'
                      }`}
                    >
                      {formatBRL(result.ported.installments[0]?.parcela ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.ported.metrics.saldoZeroAt} meses no novo contrato
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Total pago hoje</span>
                    <span className="text-lg font-semibold">{formatBRL(result.keep.metrics.totalPago)}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Total pago portando</span>
                    <span className="text-lg font-semibold">{formatBRL(result.ported.metrics.totalPago)}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                keepTitle={`Manter no ${f.bank} (${f.currentSystem})`}
                portedTitle={`Portar para ${f.newBank} (${f.newSystem} @ ${parseDecimal(f.newAnnualRate).toFixed(2)}% a.a.)`}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
