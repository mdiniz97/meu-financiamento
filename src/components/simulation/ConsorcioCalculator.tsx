'use client';

import { useEffect, useRef, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { calcularConsorcioOuFinanciamento, type ConsorcioResult } from '@/lib/finance/consorcio';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';

const DEFAULTS = {
  valor: '300000,00',
  prazo: '240',
  taxaAdmin: '18',
  taxaFin: '10.5',
};

export function ConsorcioCalculator() {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState<ConsorcioResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const [rateValid, setRateValid] = useState(true);


  const savedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result || !resultForm) return;
    if (savedFpRef.current === null) {
      savedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('consorcio-saved-fp');
    }
    const fp = JSON.stringify(resultForm);
    if (savedFpRef.current === fp) return;
    savedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('consorcio-saved-fp', fp);
    }
    (async () => {
      await saveToolSimulation({
        name: `Consórcio vs financiamento ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Consórcio vs financiamento',
        payload: { form: resultForm },
        result,
        charge: false,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function calcular() {
    setError('');
    const valor = parseBRLToNumber(form.valor);
    const prazo = Number(form.prazo);
    const taxaAdmin = parseDecimal(form.taxaAdmin);
    const taxaFin = parseDecimal(form.taxaFin);

    if (!(valor > 0)) return setError('Informe o valor do crédito.');
    if (!(prazo >= 1 && prazo <= 600)) return setError('Prazo deve ficar entre 1 e 600 meses.');
    if (!(taxaAdmin >= 0)) return setError('Taxa de administração inválida.');
    if (!rateValid || !(taxaFin >= 0)) return setError('Informe uma taxa válida.');

    try {
      const r = calcularConsorcioOuFinanciamento({
        valor,
        prazoMeses: prazo,
        taxaAdminPct: taxaAdmin,
        taxaFinanciamento: taxaFin / 100,
      });
      setResult(r);
      setResultForm(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldHelp htmlFor="conValor" label="Valor do crédito/imóvel (R$)" help="O valor da carta de crédito ou do imóvel.">
            <MoneyInput id="conValor" aria-describedby="conValor-help" value={parseBRLToNumber(form.valor)} onValid={(v) => set('valor', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="conPrazo" label="Prazo (meses)" help="Prazo das parcelas nas duas modalidades.">
            <NumericInput id="conPrazo" aria-describedby="conPrazo-help" value={Number(form.prazo)} parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))} onValid={(v) => set('prazo', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="conAdmin" label="Taxa de administração (% do crédito)" help="Ex.: 18% é o comum no consórcio imobiliário.">
            <NumericInput id="conAdmin" aria-describedby="conAdmin-help" value={parseDecimal(form.taxaAdmin)} parse={parseDecimal} onValid={(v) => set('taxaAdmin', String(v))} />
          </FieldHelp>
          <RateField id="conTaxa" label="Taxa do financiamento" value={parseDecimal(form.taxaFin)} kind="effective-annual" minEffectiveAnnual={0} onValueChange={(v) => set('taxaFin', String(v))} onKindChange={() => undefined} onValidityChange={setRateValid} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="ml-auto flex items-center gap-2">
            {result ? (
              <Button type="button" onClick={() => { setResult(null); setResultForm(null); }}>
                Nova simulação
              </Button>
            ) : (
              <Button type="button" onClick={calcular}>
                Comparar
              </Button>
            )}
          </div>
      </div>

      {result && (

        <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-lg font-semibold">Resultado</h3>
            <p className="text-sm text-muted-foreground">
              O que você pagaria em {result.prazoMeses} meses em cada modalidade.
            </p>
          </div>
            {result.totalConsorcio <= result.totalFinanciamento ? (
              <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
                <p className="text-sm">
                  <strong className="text-[#820AD1]">Consórcio mais barato no total:</strong>{' '}
                  pagando {formatBRL(result.parcelaConsorcio)}/mês você desembolsa{' '}
                  {formatBRL(result.totalConsorcio)} no fim. A taxa de administração de{' '}
                  {result.taxaAdminPct}% custa {formatBRL(result.custoConsorcio)}, enquanto os
                  juros do financiamento somariam {formatBRL(result.jurosFinanciamento)}. No papel,
                  o consórcio economiza {formatBRL(result.totalFinanciamento - result.totalConsorcio)}.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#2563EB]/30 bg-blue-500/5 p-4">
                <p className="text-sm">
                  <strong className="text-[#2563EB]">Financiamento mais barato no total:</strong>{' '}
                  a parcela de {formatBRL(result.parcelaFinanciamento)}/mês gera{' '}
                  {formatBRL(result.totalFinanciamento)} no fim, ante{' '}
                  {formatBRL(result.totalConsorcio)} do consórcio (parcela + taxa de administração
                  de {result.taxaAdminPct}%). O financiamento economiza{' '}
                  {formatBRL(result.totalConsorcio - result.totalFinanciamento)} e o imóvel é seu
                  desde o início.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Consórcio</span>
                  <span className="text-xs text-muted-foreground">Taxa de administração {result.taxaAdminPct}%</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Parcela mensal</span>
                    <span className="font-mono tabular-nums text-lg font-semibold">{formatBRL(result.parcelaConsorcio)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Total pago</span>
                    <span className="font-mono tabular-nums text-lg font-semibold">{formatBRL(result.totalConsorcio)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Custo da taxa de administração</span>
                    <span className="font-mono tabular-nums text-sm">{formatBRL(result.custoConsorcio)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Financiamento</span>
                  <span className="text-xs text-muted-foreground">Juros {form.taxaFin}% a.a. + seguros e tarifas</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Parcela mensal</span>
                    <span className="font-mono tabular-nums text-lg font-semibold">{formatBRL(result.parcelaFinanciamento)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Total pago</span>
                    <span className="font-mono tabular-nums text-lg font-semibold">{formatBRL(result.totalFinanciamento)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Custo dos juros</span>
                    <span className="font-mono tabular-nums text-sm">{formatBRL(result.jurosFinanciamento)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Como funciona</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Consórcio:</strong> você devolve o crédito de{' '}
                  {formatBRL(result.valor)} diluído em {result.prazoMeses} parcelas, mais a taxa de
                  administração de {result.taxaAdminPct}% sobre o crédito ({formatBRL(result.custoConsorcio)}).
                  Sem juros.
                </li>
                <li>
                  <strong className="text-foreground">Financiamento:</strong> você paga o mesmo
                  valor com juros de {form.taxaFin}% a.a. embutidos na parcela ({formatBRL(result.jurosFinanciamento)}
                  de juros no total).
                </li>
                <li>
                  A diferença entre os totais é o quanto uma modalidade economiza em relação à
                  outra.
                </li>
              </ol>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="flex items-start gap-2 text-sm">
                <AlarmClock className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <strong>No consórcio, o imóvel não sai na hora:</strong> você só recebe a carta
                  quando for contemplado por sorteio ou lance, o que pode demorar
                  anos ou nunca acontecer. No financiamento, o imóvel é liberado já no início e
                  você paga juros por isso.
                </span>
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              O financiamento também tem seguros e tarifas fora da parcela, não incluídos nesta
              conta. Sem contemplação, o consórcio ainda tem o fundo de reserva e reajustes do
              grupo.
            </p>
          </div>
      )}
    </div>
  );
}
