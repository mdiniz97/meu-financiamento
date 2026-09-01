'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Hammer, Info } from 'lucide-react';
import { calcularJurosDeObra, type ObraResult } from '@/lib/finance/obra';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { consumeObraCredit } from '@/app/(app)/comprar-na-planta/actions';

const DEFAULTS = {
  propertyValue: '500000,00',
  downPaymentPct: '20',
  annualRate: '10.5',
  progressPct: '0',
  insuranceMonthly: '0,00',
  financedDown: false,
  downAmount: '0,00',
  downMonths: '24',
  downHasJuros: false,
  downRate: '10.5',
};

function defaultDeliveryDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 24);
  return d.toISOString().slice(0, 10);
}

function monthsUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  return Math.max(1, Math.round((target.getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000)));
}

export function ObraCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...DEFAULTS,
    deliveryDate: defaultDeliveryDate(),
  });
  const [result, setResult] = useState<ObraResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [rateValid, setRateValid] = useState(true);

  function monthDate(m: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function calcular() {
    setError('');
    const propertyValue = parseBRLToNumber(form.propertyValue);
    const downPaymentPct = parseDecimal(form.downPaymentPct);
    const annualRate = parseDecimal(form.annualRate);
    const progressPct = parseDecimal(form.progressPct);
    const insuranceMonthly = parseBRLToNumber(form.insuranceMonthly);
    const monthsUntilDelivery = monthsUntil(form.deliveryDate);

    if (!(propertyValue > 0)) return setError('Informe o valor do imóvel (maior que zero).');
    if (!rateValid || !(annualRate >= 0)) return setError('Informe uma taxa válida.');
    if (!(downPaymentPct >= 0 && downPaymentPct < 100))
      return setError('Entrada deve ficar entre 0% e 99%.');
    if (!(progressPct >= 0 && progressPct <= 100))
      return setError('Obra concluída deve ficar entre 0% e 100%.');
    if (!form.deliveryDate) return setError('Informe a data prevista de entrega.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro mensal válido.');

    const downPaymentFinancedAmount = form.financedDown
      ? parseBRLToNumber(form.downAmount)
      : 0;
    if (form.financedDown && !(downPaymentFinancedAmount > 0))
      return setError('Informe o valor da entrada parcelado.');
    const downPaymentMonths = form.financedDown ? Number(form.downMonths) : undefined;
    if (form.financedDown && !(downPaymentMonths! >= 1 && downPaymentMonths! <= 120))
      return setError('Quantidade de parcelas da entrada deve ficar entre 1 e 120.');
    const downPaymentAnnualRate = form.financedDown && form.downHasJuros
      ? parseDecimal(form.downRate) / 100
      : undefined;
    if (
      form.financedDown &&
      form.downHasJuros &&
      !(downPaymentAnnualRate! >= 0)
    )
      return setError('Informe uma taxa válida para a entrada.');

    setBusy(true);
    try {
      const res = await consumeObraCredit();
      if (!res.ok) {
        setUpgradeOpen(true);
        return;
      }
      setResult(
        calcularJurosDeObra({
          propertyValue,
          downPaymentPct,
          annualRate: annualRate / 100,
          monthsUntilDelivery,
          progressPct,
          insuranceMonthly,
          downPaymentFinancedAmount,
          downPaymentMonths,
          downPaymentAnnualRate,
        })
      );
      // Atualiza o saldo de créditos exibido na sidebar/layout.
      router.refresh();
    } catch {
      setError('Erro ao calcular. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hammer className="size-5 text-[#820AD1]" /> Simulação de juros de obra
          </CardTitle>
          <CardDescription>
            Estime quanto você paga de juros (e seguro) até a obra ser entregue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Esta é uma <strong>simulação</strong>. O cronograma de uma obra é variável
              (atrasos, liberações diferentes do banco) e os valores podem não refletir a
              realidade do seu contrato.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldHelp htmlFor="obraValue" label="Valor do imóvel (R$)" help="Preço total do imóvel na planta, antes da entrada.">
              <MoneyInput
                id="obraValue"
                aria-describedby="obraValue-help"
                value={parseBRLToNumber(form.propertyValue)}
                onValid={(v) => set('propertyValue', numberToBRLInput(v))}
              />
            </FieldHelp>
            <FieldHelp htmlFor="obraDown" label="Entrada (%)" help="Percentual pago à vista na assinatura; o restante é financiado e liberado conforme a obra.">
              <NumericInput
                id="obraDown"
                aria-describedby="obraDown-help"
                value={parseDecimal(form.downPaymentPct)}
                parse={parseDecimal}
                onValid={(v) => set('downPaymentPct', String(v))}
              />
            </FieldHelp>
            <RateField
              id="obraRate"
              label="Taxa de juros"
              value={parseDecimal(form.annualRate)}
              kind="effective-annual"
              minEffectiveAnnual={0}
              onValueChange={(v) => set('annualRate', String(v))}
              onKindChange={() => undefined}
              onValidityChange={setRateValid}
            />
            <FieldHelp htmlFor="obraDelivery" label="Data prevista de entrega" help="Quando a construtora deve entregar a obra; a partir daí começa a amortização do saldo.">
              <input
                id="obraDelivery"
                aria-describedby="obraDelivery-help"
                type="date"
                value={form.deliveryDate}
                onChange={(e) => set('deliveryDate', e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </FieldHelp>
            <FieldHelp htmlFor="obraProgress" label="Obra concluída hoje (%)" help="Percentual da obra já concluído; o saldo já liberado corresponde a esse progresso.">
              <NumericInput
                id="obraProgress"
                aria-describedby="obraProgress-help"
                value={parseDecimal(form.progressPct)}
                parse={parseDecimal}
                onValid={(v) => set('progressPct', String(v))}
              />
            </FieldHelp>
            <FieldHelp htmlFor="obraInsurance" label="Seguro de obra (R$/mês)" help="Valor mensal do seguro de construção, cobrado junto durante a obra.">
              <MoneyInput
                id="obraInsurance"
                aria-describedby="obraInsurance-help"
                value={parseBRLToNumber(form.insuranceMonthly)}
                onValid={(v) => set('insuranceMonthly', numberToBRLInput(v))}
              />
            </FieldHelp>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-3">
            <label htmlFor="obraDownFinanced" className="flex items-center justify-between gap-2 text-sm font-medium">
              <span>
                Financiei a entrada
                <span className="block text-xs font-normal text-muted-foreground">
                  A entrada também é parcelada/financiada até a entrega? Informe como você a paga.
                </span>
              </span>
              <Switch
                id="obraDownFinanced"
                checked={form.financedDown}
                onCheckedChange={(v) => set('financedDown', v)}
              />
            </label>
            {form.financedDown && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Valor parcelado (R$)</span>
                  <MoneyInput
                    aria-label="Valor da entrada parcelado (R$)"
                    value={parseBRLToNumber(form.downAmount)}
                    onValid={(v) => set('downAmount', numberToBRLInput(v))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Parcelas</span>
                  <NumericInput
                    aria-label="Quantidade de parcelas da entrada"
                    value={Number(form.downMonths)}
                    parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))}
                    onValid={(v) => set('downMonths', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Tem juros?</span>
                  <RadioGroup
                    value={String(form.downHasJuros)}
                    onValueChange={(v) => set('downHasJuros', v === 'true')}
                    className="flex h-8 items-center gap-4"
                  >
                    <label className="flex items-center gap-1.5 text-sm">
                      <RadioGroupItem value="true" /> Sim
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <RadioGroupItem value="false" /> Não
                    </label>
                  </RadioGroup>
                </div>
                {form.downHasJuros && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Taxa (%)</span>
                    <NumericInput
                      aria-label="Taxa da entrada (%)"
                      value={parseDecimal(form.downRate)}
                      parse={parseDecimal}
                      onValid={(v) => set('downRate', String(v))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="ml-auto flex items-center gap-2">
              {result && (
                <Button type="button" variant="outline" size="sm" onClick={() => setResult(null)}>
                  Nova simulação
                </Button>
              )}
              <Button type="button" onClick={calcular} disabled={busy}>
                {busy ? 'Calculando…' : 'Calcular juros de obra'}
                {!isUnlimited && (
                  <span aria-hidden className="ml-1.5 inline-flex items-center gap-1 text-xs font-semibold">
                    <Coins className="size-3.5" /> -1
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg">Resultado da simulação</CardTitle>
            <CardDescription>
              Considerando obra concluída hoje em {parseDecimal(form.progressPct)}% e entrega
              em ~{monthsUntil(form.deliveryDate)} meses.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Total de juros de obra', value: formatBRL(result.totalJuros) },
                { label: 'Total do seguro de obra', value: formatBRL(result.totalSeguro) },
                { label: 'Total pago na entrada', value: formatBRL(result.totalEntrada) },
                {
                  label: 'Você desembolsa até a entrega',
                  value: formatBRL(result.totalDuranteObra),
                },
                {
                  label: 'Primeira parcela após entrega (PRICE 360m)',
                  value: formatBRL(result.primeiraParcelaPrice),
                },
                {
                  label: 'Primeira parcela após entrega (SAC 360m)',
                  value: formatBRL(result.primeiraParcelaSac),
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/50 p-4">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-lg font-semibold tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Mês</th>
                    <th className="px-4 py-2 font-medium">MM/AAAA</th>
                    <th className="px-4 py-2 text-right font-medium">Obra concluída</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo já liberado (acumulado)</th>
                    <th className="px-4 py-2 text-right font-medium">Juros do mês</th>
                    <th className="px-4 py-2 text-right font-medium">Seguro do mês</th>
                    <th className="px-4 py-2 text-right font-medium">Entrada</th>
                    <th className="px-4 py-2 text-right font-semibold text-[#820AD1] dark:text-[#a44ce0]">Você paga neste mês</th>
                  </tr>
                </thead>
                <tbody>
                  {result.monthly.map((m) => (
                    <tr key={m.month} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2">{m.month}</td>
                      <td className="px-4 py-2 tabular-nums">{monthDate(m.month)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.progressPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(m.saldoLiberado)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(m.juros)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(m.seguro)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.entradaParcela > 0 ? formatBRL(m.entradaParcela) : '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-[#820AD1] dark:text-[#a44ce0]">{formatBRL(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              O &quot;Você paga neste mês&quot; é juros + seguro do mês. Durante a obra esse valor não
              reduz sua dívida: é o custo financeiro até a entrega das chaves.
            </p>
          </CardContent>
        </Card>
      )}

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
