'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calcularAlugarOuComprar, type AlugarComprarResult } from '@/lib/finance/alugar-comprar';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';

const DEFAULTS = {
  imovel: '500000,00',
  entrada: '100000,00',
  aluguel: '2500,00',
  taxaFin: '10.5',
  selic: '10.5',
  valorizacao: '4',
  prazoAnos: '10',
  prazoFinAnos: '30',
};

export function AlugarComprarCalculator({
  selicAnnual,
}: {
  selicAnnual: number | null;
}) {
  const [form, setForm] = useState({
    ...DEFAULTS,
    selic: selicAnnual === null ? '10.5' : String(selicAnnual),
  });
  const [result, setResult] = useState<AlugarComprarResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const [rateValid, setRateValid] = useState(true);

  const rf = resultForm ?? form;

  const savedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result || !resultForm) return;
    if (savedFpRef.current === null) {
      savedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('alugar-saved-fp');
    }
    const fp = JSON.stringify(resultForm);
    if (savedFpRef.current === fp) return;
    savedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('alugar-saved-fp', fp);
    }
    (async () => {
      await saveToolSimulation({
        name: `Alugar ou comprar ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Alugar ou comprar',
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
    const imovel = parseBRLToNumber(form.imovel);
    const entrada = parseBRLToNumber(form.entrada);
    const aluguel = parseBRLToNumber(form.aluguel);
    const taxaFin = parseDecimal(form.taxaFin);
    const selic = parseDecimal(form.selic);
    const valorizacao = parseDecimal(form.valorizacao);

    if (!(imovel > 0)) return setError('Informe o valor do imóvel.');
    if (!(entrada >= 0 && entrada < imovel)) return setError('Entrada deve ser menor que o imóvel.');
    if (!(aluguel > 0)) return setError('Informe o aluguel mensal.');
    if (!rateValid || !(taxaFin >= 0)) return setError('Informe uma taxa válida.');
    if (!(selic >= 0)) return setError('Informe a taxa de investimento.');

    try {
      const r = calcularAlugarOuComprar({
        imovelValor: imovel,
        entrada,
        aluguelMensal: aluguel,
        taxaFinanciamento: taxaFin / 100,
        selicAnual: selic / 100,
        valorizacaoAnual: valorizacao / 100,
        prazoMeses: Number(form.prazoAnos) * 12,
        mesesFinanciamento: Number(form.prazoFinAnos) * 12,
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
            <KeyRound className="size-5 text-[#820AD1]" /> Alugar ou comprar?
          </CardTitle>
          <CardDescription>
            Compare o patrimônio construído comprando (imóvel menos dívida) com o de continuar
            alugando e investindo a diferença. Este modelo considera aluguel até o valor da
            parcela e horizonte até o fim do financiamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldHelp htmlFor="acImovel" label="Valor do imóvel (R$)" help="Preço do imóvel que você quer comprar.">
              <MoneyInput id="acImovel" aria-describedby="acImovel-help" value={parseBRLToNumber(form.imovel)} onValid={(v) => set('imovel', numberToBRLInput(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="acEntrada" label="Entrada (R$)" help="Quanto você tem para a entrada.">
              <MoneyInput id="acEntrada" aria-describedby="acEntrada-help" value={parseBRLToNumber(form.entrada)} onValid={(v) => set('entrada', numberToBRLInput(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="acAluguel" label="Aluguel mensal (R$)" help="O aluguel que você paga hoje.">
              <MoneyInput id="acAluguel" aria-describedby="acAluguel-help" value={parseBRLToNumber(form.aluguel)} onValid={(v) => set('aluguel', numberToBRLInput(v))} />
            </FieldHelp>
            <RateField id="acTaxa" label="Taxa do financiamento" value={parseDecimal(form.taxaFin)} kind="effective-annual" minEffectiveAnnual={0} onValueChange={(v) => set('taxaFin', String(v))} onKindChange={() => undefined} onValidityChange={setRateValid} />
            <FieldHelp htmlFor="acSelic" label="Taxa de investimento (Selic % a.a.)" help="Já vem com a Selic atual do BACEN.">
              <NumericInput id="acSelic" aria-describedby="acSelic-help" value={parseDecimal(form.selic)} parse={parseDecimal} onValid={(v) => set('selic', String(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="acVal" label="Valorização do imóvel (% a.a.)" help="Quanto o imóvel tende a valorizar por ano.">
              <NumericInput id="acVal" aria-describedby="acVal-help" value={parseDecimal(form.valorizacao)} parse={parseDecimal} onValid={(v) => set('valorizacao', String(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="acPrazo" label="Horizonte (anos)" help="Prazo da comparação.">
              <NumericInput id="acPrazo" aria-describedby="acPrazo-help" value={Number(form.prazoAnos)} parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))} onValid={(v) => set('prazoAnos', String(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="acPrazoFin" label="Prazo do financiamento (anos)" help="Em quantos anos o financiamento é pago.">
              <NumericInput id="acPrazoFin" aria-describedby="acPrazoFin-help" value={Number(form.prazoFinAnos)} parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))} onValid={(v) => set('prazoFinAnos', String(v))} />
            </FieldHelp>
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
        </CardContent>
      </Card>

      {result && (

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg">Resultado</CardTitle>
            <CardDescription>
              O que acontece com seu patrimônio em {rf.prazoAnos} anos em cada caminho.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {result.mesEmpate === null ? (
              <div className="rounded-2xl border border-[#2563EB]/30 bg-blue-500/5 p-4">
                <p className="text-sm">
                  <strong className="text-[#2563EB]">Alugar continua valendo mais:</strong> ao fim
                  de {rf.prazoAnos} anos, seu patrimônio alugando e investindo a diferença (
                  {formatBRL(result.patrimonioAluguel)}) ainda supera o patrimônio comprando (
                  {formatBRL(result.patrimonioCompra)}). Nesse cenário, comprar nunca passa a ser
                   melhor que alugar dentro do horizonte informado.
                </p>
              </div>
            ) : result.patrimonioCompra > result.patrimonioAluguel ? (
              <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
                <p className="text-sm">
                  <strong className="text-[#820AD1]">Comprar vale mais a partir do mês {result.mesEmpate} (~{(result.mesEmpate / 12).toFixed(1)} anos):</strong>{' '}
                  seu patrimônio comprando ({formatBRL(result.patrimonioCompra)}) supera o de
                  alugar e investir ({formatBRL(result.patrimonioAluguel)}) por{' '}
                  <strong>{formatBRL(result.patrimonioCompra - result.patrimonioAluguel)}</strong>.
                  Até lá, o aluguel ainda estava na frente.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#2563EB]/30 bg-blue-500/5 p-4">
                <p className="text-sm">
                  <strong className="text-[#2563EB]">Alugar ainda vale mais ao fim do prazo:</strong>{' '}
                  mesmo com o cruzamento das curvas no mês {result.mesEmpate} (~{(result.mesEmpate / 12).toFixed(1)} anos),
                  ao fim de {rf.prazoAnos} anos o patrimônio alugando ({formatBRL(result.patrimonioAluguel)}) supera
                  o de comprar ({formatBRL(result.patrimonioCompra)}) por{' '}
                  <strong>{formatBRL(result.patrimonioAluguel - result.patrimonioCompra)}</strong>.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: 'Patrimônio comprando',
                  desc: `Imóvel valorizado (${formatBRL(result.imovelFinal)}) menos o que ainda falta pagar`,
                  value: formatBRL(result.patrimonioCompra),
                },
                {
                  label: 'Patrimônio alugando',
                  desc: `Entrada + parcela poupada, rendendo ${rf.selic}% a.a.`,
                  value: formatBRL(result.patrimonioAluguel),
                },
                {
                  label: 'Diferença ao fim',
                  desc: result.patrimonioCompra >= result.patrimonioAluguel ? 'Comprar ganha essa quantia' : 'Alugar ganha essa quantia',
                  value: formatBRL(Math.abs(result.patrimonioCompra - result.patrimonioAluguel)),
                },
                {
                  label: 'Parcela do financiamento',
                  desc: `O que você pagaria de parcela em vez de aluguel`,
                  value: formatBRL(result.parcela),
                },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/50 p-4">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="font-mono tabular-nums text-lg font-semibold">{item.value}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Patrimônio mês a mês (comprando vs alugando)
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={result.monthly}>
                  <XAxis dataKey="month" tickFormatter={(m) => `m${m}`} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      formatBRL(Number(value)),
                      name === 'patrimonioCompra' ? 'Comprando' : 'Alugando',
                    ]}
                  />
                  <Line type="monotone" dataKey="patrimonioCompra" stroke="#820AD1" strokeWidth={2} dot={false} name="patrimonioCompra" />
                  <Line type="monotone" dataKey="patrimonioAluguel" stroke="#2563EB" strokeWidth={2} dot={false} name="patrimonioAluguel" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Como funciona a comparação</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Comprando:</strong> entrada de{' '}
                  {formatBRL(result.entrada)} + {formatBRL(result.parcela)}/mês durante{' '}
                  {rf.prazoFinAnos} anos. A cada mês, o imóvel valoriza {rf.valorizacao}% a.a. e a
                  dívida diminui; o patrimônio é imóvel − dívida.
                </li>
                <li>
                  <strong className="text-foreground">Alugando:</strong> aluguel de{' '}
                  {formatBRL(result.aluguelMensal)}/mês, enquanto entrada e a diferença entre parcela e
                  aluguel rendem {rf.selic}% a.a.
                </li>
                <li>
                  No mês em que a curva de comprar ultrapassa a de alugar, comprar passa a valer
                  mais.
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              Simulação simplificada: valorização do imóvel e Selic constantes, aluguel sem
              reajuste e parcela PRICE. Não cobre aluguel acima da parcela nem investimentos
              de quem compra após a quitação. Impostos e custos de aquisição não estão incluídos. Não
              é recomendação de investimento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
