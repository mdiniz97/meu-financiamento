'use client';

import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { calcularMetaQuitacao, type MetaQuitacaoResult } from '@/lib/finance/meta-quitacao';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RateField } from '@/components/ui/rate-field';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';

const DEFAULTS = {
  saldo: '400000,00',
  prazo: '360',
  taxa: '10.5',
  sistema: 'PRICE' as 'PRICE' | 'SAC',
  metaAnos: '10',
};

export function MetaCalculator() {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState<MetaQuitacaoResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const [rateValid, setRateValid] = useState(true);

  const rf = resultForm ?? form;

  const savedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result || !resultForm) return;
    if (savedFpRef.current === null) {
      savedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('meta-saved-fp');
    }
    const fp = JSON.stringify(resultForm);
    if (savedFpRef.current === fp) return;
    savedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('meta-saved-fp', fp);
    }
    (async () => {
      await saveToolSimulation({
        name: `Meta de quitação ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Meta de quitação',
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
    const saldo = parseBRLToNumber(form.saldo);
    const prazo = Number(form.prazo);
    const taxa = parseDecimal(form.taxa);
    const metaMeses = Number(form.metaAnos) * 12;

    if (!Number.isFinite(saldo) || !(saldo > 0)) return setError('Informe o saldo devedor (maior que zero).');
    if (!rateValid || !Number.isFinite(taxa) || !(taxa >= 0)) return setError('Informe uma taxa válida.');
    if (!Number.isSafeInteger(prazo) || !(prazo >= 1 && prazo <= 600))
      return setError('Prazo deve ser inteiro entre 1 e 600 meses.');
    if (!Number.isSafeInteger(metaMeses) || !(metaMeses >= 1 && metaMeses <= 600))
      return setError('Meta deve corresponder a um número inteiro entre 1 e 600 meses.');

    try {
      const r = calcularMetaQuitacao({
        saldoDevedor: saldo,
        taxaFinanciamento: taxa / 100,
        prazoRestanteMeses: prazo,
        sistema: form.sistema,
        metaMeses,
      });
      setResult(r);
      setResultForm(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
            <Target className="size-5 text-[#820AD1]" /> Meta de quitação
          </CardTitle>
          <CardDescription>
            Informe em quanto tempo você quer quitar e descubra o aporte mensal necessário.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldHelp htmlFor="metaSaldo" label="Saldo devedor (R$)" help="Quanto falta pagar hoje.">
              <MoneyInput
                id="metaSaldo"
                aria-describedby="metaSaldo-help"
                value={parseBRLToNumber(form.saldo)}
                onValid={(v) => set('saldo', numberToBRLInput(v))}
              />
            </FieldHelp>
            <FieldHelp htmlFor="metaPrazo" label="Prazo restante (meses)" help="Quantos meses faltam no contrato atual.">
              <NumericInput
                id="metaPrazo"
                aria-describedby="metaPrazo-help"
                value={Number(form.prazo)}
                parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))}
                onValid={(v) => set('prazo', String(v))}
              />
            </FieldHelp>
            <RateField
              id="metaTaxa"
              label="Taxa do financiamento"
              value={parseDecimal(form.taxa)}
              kind="effective-annual"
              minEffectiveAnnual={0}
              onValueChange={(v) => set('taxa', String(v))}
              onKindChange={() => undefined}
              onValidityChange={setRateValid}
            />
            <FieldHelp htmlFor="metaAnos" label="Quero quitar em (anos)" help="Sua meta: em quantos anos a dívida deve zerar.">
              <NumericInput
                id="metaAnos"
                aria-describedby="metaAnos-help"
                value={Number(form.metaAnos)}
                parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))}
                onValid={(v) => set('metaAnos', String(v))}
              />
            </FieldHelp>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Sistema</span>
              <RadioGroup
                value={form.sistema}
                onValueChange={(v) => set('sistema', v as 'PRICE' | 'SAC')}
                className="flex h-8 items-center gap-4"
              >
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="PRICE" /> PRICE
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="SAC" /> SAC
                </label>
              </RadioGroup>
            </div>
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
                  Calcular aporte
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg">Resultado</CardTitle>
            <CardDescription>
              Sua meta é quitar em até {rf.metaAnos} {Number(rf.metaAnos) === 1 ? 'ano' : 'anos'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {result.metaMaiorQuePrazo ? (
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-sm">
                  Sua meta ({rf.metaAnos} anos) é maior ou igual ao prazo atual de {rf.prazo} meses:
                  mantenha o cronograma original, sem alongar a dívida. A parcela atual é{' '}
                  {formatBRL(result.parcelaAtual)}{rf.sistema === 'SAC' ? ', seguindo o SAC nos meses seguintes' : ', constante no PRICE'}.
                  Nenhum aporte extra é necessário e a economia adicional de juros é zero.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
                <p className="text-sm">
                  <strong className="text-[#820AD1]">Para quitar em {rf.metaAnos} {Number(rf.metaAnos) === 1 ? 'ano' : 'anos'}:</strong>{' '}
                  sua parcela hoje é {formatBRL(result.parcelaAtual)} ({rf.sistema}). Somando um{' '}
                  <strong>aporte extra fixo de {formatBRL(result.aporteMensal)}/mês</strong>,{' '}
                  {rf.sistema === 'SAC'
                    ? <>o total no primeiro mês é {formatBRL(result.pagamentoTotal)}, com parcelas decrescentes quando há juros.</>
                    : <>o pagamento total fica constante em {formatBRL(result.pagamentoTotal)}/mês.</>}{' '}
                  Na simulação, a dívida zera na meta, com{' '}
                  <strong>economia de {formatBRL(result.economiaJuros)} de juros</strong>.
                </p>
                {rf.sistema === 'SAC' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No SAC, o aporte extra permanece fixo além da parcela de cada mês. A amortização
                    contratual é mantida para reduzir o prazo; os juros incidem sobre o saldo que
                    diminui. O aporte não substitui o pagamento do boleto.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Parcela atual', desc: `O que você paga hoje no contrato (${rf.sistema})`, value: formatBRL(result.parcelaAtual) },
                { label: 'Aporte mensal fixo', desc: result.aporteMensal > 0 ? 'Mesmo extra além da parcela de cada mês' : 'Sem aporte extra necessário', value: formatBRL(result.aporteMensal) },
                { label: rf.sistema === 'SAC' ? 'Total no primeiro mês' : 'Pagamento total', desc: rf.sistema === 'SAC' ? 'Parcela + aporte; diminui conforme os juros caem' : 'Parcela + aporte, constante até quitar', value: formatBRL(result.pagamentoTotal) },
                { label: 'Economia de juros', desc: 'Juros evitados em relação ao cronograma original', value: formatBRL(result.economiaJuros) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/50 p-4">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="font-mono tabular-nums text-lg font-semibold">{item.value}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Como funciona</p>
              <ol className="mt-1 list-decimal pl-4 text-sm text-muted-foreground">
                <li>O cronograma original quita em {rf.prazo} meses, com {formatBRL(result.jurosOriginais)} de juros.</li>
                <li>
                  {result.metaMaiorQuePrazo
                    ? 'Sua meta não antecipa a quitação: mantenha as parcelas e o prazo originais.'
                    : rf.sistema === 'SAC'
                      ? `O aporte fixo de ${formatBRL(result.aporteMensal)} soma-se à amortização contratual. O total começa em ${formatBRL(result.pagamentoTotal)} e cai com os juros sobre o saldo.`
                      : `Para antecipar, pague o total constante de ${formatBRL(result.pagamentoTotal)} (parcela + aporte).`}
                </li>
                <li>Juros com esta meta: {formatBRL(result.jurosTotais)}. Economia estimada: {formatBRL(result.economiaJuros)}.</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Estimativa com taxa constante, sem TR, seguros ou tarifas. Confirme com o banco as
              condições para amortizar reduzindo prazo. Não é garantia de quitação nem recomendação
              de investimento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
