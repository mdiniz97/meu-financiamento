'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Target } from 'lucide-react';
import { calcularMetaQuitacao, type MetaQuitacaoResult } from '@/lib/finance/meta-quitacao';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RateField } from '@/components/ui/rate-field';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';

const DEFAULTS = {
  saldo: '400000,00',
  prazo: '360',
  taxa: '10.5',
  sistema: 'PRICE' as 'PRICE' | 'SAC',
  metaAnos: '10',
};

export function MetaCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState<MetaQuitacaoResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const [rateValid, setRateValid] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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
      const res = await saveToolSimulation({
        name: `Meta de quitação ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Meta de quitação',
        payload: { form: resultForm },
        result,
        charge: true,
      });
      if ('error' in res) setUpgradeOpen(true);
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

    if (!(saldo > 0)) return setError('Informe o saldo devedor (maior que zero).');
    if (!rateValid || !(taxa >= 0)) return setError('Informe uma taxa válida.');
    if (!(prazo >= 1 && prazo <= 600)) return setError('Prazo deve ficar entre 1 e 600 meses.');
    if (!(metaMeses >= 1 && metaMeses <= 600)) return setError('Meta deve ficar entre 1 e 600 meses.');

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
          <CardTitle className="flex items-center gap-2 text-lg">
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
                  {!isUnlimited && (
                    <span aria-hidden className="ml-1.5 inline-flex items-center gap-1 text-xs font-semibold">
                      <Coins className="size-3.5" /> -1
                    </span>
                  )}
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
              O que muda se você quitar em {rf.metaAnos} {Number(rf.metaAnos) === 1 ? 'ano' : 'anos'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {result.metaMaiorQuePrazo ? (
              <div className="rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-sm">
                  Sua meta ({rf.metaAnos} anos) é maior ou igual ao prazo atual de {rf.prazo} meses:
                  basta seguir pagando a parcela de {formatBRL(result.parcelaAtual)}. Nenhum aporte
                  extra é necessário.
                </p>
              </div>
            ) : result.aporteMensal > 0 ? (
              <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
                <p className="text-sm">
                  <strong className="text-[#820AD1]">Para quitar em {rf.metaAnos} {Number(rf.metaAnos) === 1 ? 'ano' : 'anos'}:</strong>{' '}
                  sua parcela hoje é {formatBRL(result.parcelaAtual)} ({rf.sistema}). Somando um{' '}
                  <strong>aporte de {formatBRL(result.aporteMensal)}/mês</strong>, o pagamento total
                  fica em {formatBRL(result.pagamentoTotal)}/mês e a dívida zera na meta,{' '}
                  <strong>economizando {formatBRL(result.economiaJuros)} de juros</strong>.
                </p>
                {rf.sistema === 'SAC' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No SAC a parcela cai mês a mês: esse é o aporte do primeiro mês; ele cresce
                    conforme a parcela diminui, mantendo o total fixo.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
                <p className="text-sm">
                  <strong className="text-[#820AD1]">Para quitar em {rf.metaAnos} {Number(rf.metaAnos) === 1 ? 'ano' : 'anos'}:</strong>{' '}
                  no SAC a parcela começa alta ({formatBRL(result.parcelaAtual)}) e cai sozinha.
                  Pagando o total de {formatBRL(result.pagamentoTotal)}/mês desde o início (sem
                  aporte extra nos primeiros meses), a dívida quita na meta,{' '}
                  <strong>economizando {formatBRL(result.economiaJuros)} de juros</strong>.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Parcela atual', desc: `O que você paga hoje no contrato (${rf.sistema})`, value: formatBRL(result.parcelaAtual) },
                { label: 'Aporte mensal', desc: result.aporteMensal > 0 ? 'Extra além da parcela, para quitar na meta' : 'Sem aporte extra necessário', value: formatBRL(Math.max(0, result.aporteMensal)) },
                { label: 'Pagamento total', desc: 'Parcela + aporte, todo mês até quitar', value: formatBRL(result.pagamentoTotal) },
                { label: 'Economia de juros', desc: 'Juros que deixam de existir até quitar', value: formatBRL(Math.max(0, result.economiaJuros)) },
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
                <li>Sua parcela atual quita o contrato no prazo original ({rf.prazo} meses).</li>
                <li>
                  Para quitar antes, o pagamento mensal total precisa subir para{' '}
                  {formatBRL(result.pagamentoTotal)} (parcela + aporte).
                </li>
                <li>Quitando mais cedo, os juros dos meses restantes deixam de existir: economia de {formatBRL(result.economiaJuros)}.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
