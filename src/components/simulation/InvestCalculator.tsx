'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Scale } from 'lucide-react';
import { calcularInvestOuAmortizar, type CenarioId, type InvestResult } from '@/lib/finance/invest-ou-amortizar';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';

export function InvestCalculator({
  selicAnnual,
}: {
  selicAnnual: number | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    saldoDevedor: '500000,00',
    prazoRestante: '360',
    taxaFinanciamento: '10.5',
    valorDisponivel: '100000,00',
    selic: selicAnnual === null ? '10.5' : String(selicAnnual),
    sistema: 'PRICE' as 'PRICE' | 'SAC',
  });
  const [result, setResult] = useState<InvestResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rateValid, setRateValid] = useState(true);

  const rf = resultForm ?? form;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function calcular() {
    setError('');
    const saldoDevedor = parseBRLToNumber(form.saldoDevedor);
    const prazoRestante = Number(form.prazoRestante);
    const taxaFinanciamento = parseDecimal(form.taxaFinanciamento);
    const valorDisponivel = parseBRLToNumber(form.valorDisponivel);
    const selic = parseDecimal(form.selic);

    if (!Number.isFinite(saldoDevedor) || !(saldoDevedor > 0)) return setError('Informe o saldo devedor (maior que zero).');
    if (!Number.isSafeInteger(prazoRestante) || !(prazoRestante >= 1 && prazoRestante <= 600))
      return setError('Prazo restante deve ser inteiro entre 1 e 600 meses.');
    if (!rateValid || !Number.isFinite(taxaFinanciamento) || !(taxaFinanciamento >= 0))
      return setError('Informe uma taxa válida.');
    if (!Number.isFinite(valorDisponivel) || !(valorDisponivel > 0))
      return setError('Informe o valor disponível (maior que zero).');
    if (valorDisponivel > saldoDevedor)
      return setError('O valor disponível não pode superar o saldo devedor.');
    if (!Number.isFinite(selic) || !(selic >= 0)) return setError('Informe a taxa de investimento (Selic).');

    setBusy(true);
    try {
      setResult(
        calcularInvestOuAmortizar({
          saldoDevedor,
          prazoRestanteMeses: prazoRestante,
          taxaFinanciamento: taxaFinanciamento / 100,
          valorDisponivel,
          selicAnual: selic / 100,
          horizonteMeses: prazoRestante,
          sistema: form.sistema,
        })
      );
      setResultForm(form);
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
            <Scale className="size-5 text-[#820AD1]" /> Comparativo investimento × amortização
          </CardTitle>
          <CardDescription>
            Compare os juros totais de cada estratégia até quitar a dívida. Não é uma comparação
            de patrimônio ou de retorno em um horizonte escolhido.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Esta é uma <strong>simulação</strong> com a Selic de hoje, ela muda a cada
              reunião do Copom. Não é recomendação de investimento.
            </span>
          </div>

          <div className="grid gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm sm:grid-cols-3">
            <p>
              <strong>1.</strong> Você tem um valor disponível hoje (ex.: R$ 100 mil) e quer
              saber o que faz mais sentido.
            </p>
            <p>
              <strong>2.</strong> <strong>Amortizar</strong>: o valor abate a dívida para reduzir
              a parcela ou o prazo. A simulação não reinveste a diferença de parcela.
            </p>
            <p>
              <strong>3.</strong> <strong>Investir</strong>: o principal fica aplicado e o
              rendimento líquido mensal amortiza a dívida, além da parcela contratual.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldHelp htmlFor="invSaldo" label="Saldo devedor (R$)" help="Quanto falta pagar do financiamento hoje.">
              <MoneyInput
                id="invSaldo"
                aria-describedby="invSaldo-help"
                value={parseBRLToNumber(form.saldoDevedor)}
                onValid={(v) => set('saldoDevedor', numberToBRLInput(v))}
              />
            </FieldHelp>
            <FieldHelp htmlFor="invPrazo" label="Prazo restante (meses)" help="Quantos meses faltam para quitar o financiamento.">
              <NumericInput
                id="invPrazo"
                aria-describedby="invPrazo-help"
                value={Number(form.prazoRestante)}
                parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))}
                onValid={(v) => set('prazoRestante', String(v))}
              />
            </FieldHelp>
            <FieldHelp htmlFor="invValor" label="Valor disponível (R$)" help="Quanto você tem para investir ou amortizar.">
              <MoneyInput
                id="invValor"
                aria-describedby="invValor-help"
                value={parseBRLToNumber(form.valorDisponivel)}
                onValid={(v) => set('valorDisponivel', numberToBRLInput(v))}
              />
            </FieldHelp>
            <RateField
              id="invTaxa"
              label="Taxa do financiamento"
              value={parseDecimal(form.taxaFinanciamento)}
              kind="effective-annual"
              minEffectiveAnnual={0}
              onValueChange={(v) => set('taxaFinanciamento', String(v))}
              onKindChange={() => undefined}
              onValidityChange={setRateValid}
            />
            <FieldHelp
              htmlFor="invSelic"
              label="Taxa de investimento (Selic % a.a.)"
              help="Já vem preenchida com a Selic atual do BACEN; ajuste se quiser simular outro cenário."
            >
              <NumericInput
                id="invSelic"
                aria-describedby="invSelic-help"
                value={parseDecimal(form.selic)}
                parse={parseDecimal}
                onValid={(v) => set('selic', String(v))}
              />
            </FieldHelp>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Sistema do financiamento:</span>
            <div className="flex gap-4">
              {(['PRICE', 'SAC'] as const).map((system) => (
                <label key={system} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="invSistema"
                    checked={form.sistema === system}
                    onChange={() => set('sistema', system)}
                    className="h-4 w-4 accent-[#820AD1]"
                  />
                  {system}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="ml-auto flex items-center gap-2">
              {result ? (
                <Button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setResultForm(null);
                  }}
                >
                  Nova simulação
                </Button>
              ) : (
                <Button type="button" onClick={calcular} disabled={busy}>
                  {busy ? 'Calculando…' : 'Comparar'}

                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg">
              Resultado da comparação
            </CardTitle>
            <CardDescription>
              Três formas de usar os {formatBRL(parseBRLToNumber(rf.valorDisponivel))}, o que
              muda nos juros totais do seu contrato e no tempo de quitação. Parcela atual:{' '}
              {formatBRL(result.parcelaOriginal)} ({rf.sistema}); juros totais do contrato:{' '}
              {formatBRL(result.jurosTotaisOriginal)}.{' '}
              {rf.sistema === 'SAC' && 'No SAC, o valor mostrado é o do primeiro mês; as parcelas caem conforme os juros diminuem.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Esta é uma simulação com a Selic de hoje; ela muda a cada reunião do Copom.
                Não é recomendação de investimento.
              </span>
            </div>
            <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
              <p className="text-sm">
                <strong className="text-[#820AD1]">
                  Maior economia de juros:{' '}
                  {result.melhorEconomia === 'reduzir-parcela'
                    ? 'reduzir a parcela'
                    : result.melhorEconomia === 'reduzir-prazo'
                      ? 'reduzir o prazo'
                      : 'investir e amortizar com o rendimento'}
                </strong>{' '}
                <strong>
                  {formatBRL(result.estrategias[result.melhorEconomia].economiaJuros)}
                </strong>{' '}
                de juros até quitar, nas condições simuladas. Não indica maior patrimônio final;
                o rendimento do investimento depende da Selic futura.
              </p>
              {result.melhorEconomia !== 'investir-rendimento' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Amortizar economiza{' '}
                  <strong>
                    {formatBRL(
                      result.estrategias[result.melhorEconomia].economiaJuros -
                        result.estrategias['investir-rendimento'].economiaJuros
                    )}
                  </strong>{' '}
                  a mais de juros, mas quem investe termina com os{' '}
                  <strong>{formatBRL(parseBRLToNumber(rf.valorDisponivel))} no bolso</strong>.
                </p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {(
                [
                  {
                    id: 'reduzir-parcela' as CenarioId,
                    titulo: 'Reduzir a parcela',
                    descricao: result.estrategias['reduzir-parcela'].quitaEmMeses === 0
                      ? 'O valor disponível quita todo o saldo hoje, sem novas parcelas.'
                      : `Você abate ${formatBRL(parseBRLToNumber(rf.valorDisponivel))} da dívida e a parcela cai de ${formatBRL(result.parcelaOriginal)} para ${formatBRL(result.estrategias['reduzir-parcela'].parcela ?? 0)} (${rf.sistema}). O prazo continua o mesmo.${rf.sistema === 'SAC' ? ' Valores do primeiro mês; a nova amortização é constante e as parcelas caem com os juros.' : ''}`,
                  },
                  {
                    id: 'reduzir-prazo' as CenarioId,
                    titulo: 'Reduzir o prazo',
                    descricao: result.estrategias['reduzir-prazo'].quitaEmMeses === 0
                      ? 'O valor disponível quita todo o saldo hoje, sem novas parcelas.'
                      : rf.sistema === 'SAC'
                        ? `Você abate ${formatBRL(parseBRLToNumber(rf.valorDisponivel))} e mantém a amortização contratual de ${formatBRL(parseBRLToNumber(rf.saldoDevedor) / Number(rf.prazoRestante))}/mês. Os juros incidem sobre o saldo reduzido; a parcela não fica fixa e o prazo diminui.`
                        : `Você abate ${formatBRL(parseBRLToNumber(rf.valorDisponivel))} e mantém a prestação PRICE constante de ${formatBRL(result.parcelaOriginal)} até quitar, reduzindo o prazo.`,
                  },
                  {
                    id: 'investir-rendimento' as CenarioId,
                    titulo: 'Investir e amortizar com o rendimento',
                    descricao: `Os ${formatBRL(parseBRLToNumber(rf.valorDisponivel))} ficam investidos na Selic (${parseDecimal(rf.selic).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.) e o rendimento líquido mensal amortiza a dívida, sem reinvestir os rendimentos.${rf.sistema === 'SAC' ? ' A amortização contratual é mantida e os juros da parcela caem com o saldo.' : ' A prestação PRICE original permanece constante.'}`,
                  },
                ] as const
              ).map((cenario) => {
                const c = result.estrategias[cenario.id];
                const vencedor = result.melhorEconomia === cenario.id;
                return (
                  <Card
                    key={cenario.id}
                    className={`rounded-2xl shadow-sm ${
                      vencedor ? 'ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : ''
                    }`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {cenario.titulo}
                        {vencedor && (
                          <Badge variant="secondary" className="text-xs">Maior economia</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{cenario.descricao}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Quita a dívida em</span>
                        <span className="font-semibold font-mono tabular-nums">
                          {c.quitaEmMeses === null
                            ? 'mais de 600 meses'
                            : c.quitaEmMeses === 0
                              ? 'Hoje'
                              : `${c.quitaEmMeses} ${c.quitaEmMeses === 1 ? 'mês' : 'meses'}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Juros totais do contrato</span>
                        <span className="font-semibold font-mono tabular-nums">{formatBRL(c.jurosTotais)}</span>
                      </div>
                      {c.mantemPrincipal && (
                        <div className="rounded-xl border border-[#820AD1]/40 bg-primary/[0.04] px-3 py-2">
                          <span className="text-xs text-muted-foreground">
                            No fim das contas, você ainda tem
                          </span>
                          <span className="block text-xl font-bold font-mono tabular-nums text-[#820AD1] dark:text-[#a44ce0]">
                            {formatBRL(parseBRLToNumber(rf.valorDisponivel))} no bolso
                          </span>
                          <span className="text-xs text-muted-foreground">
                            O valor continua investido.
                          </span>
                        </div>
                      )}
                      <div className="border-t border-border pt-3">
                        <span className="text-xs text-muted-foreground">
                          Economia de juros até quitar
                        </span>
                        <span className="block text-2xl font-bold font-mono tabular-nums text-[#820AD1] dark:text-[#a44ce0]">
                          {formatBRL(c.economiaJuros)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(result.jurosTotaisOriginal > 0 ? (c.economiaJuros / result.jurosTotaisOriginal) * 100 : 0).toFixed(0)}%
                          dos juros do contrato original ({formatBRL(result.jurosTotaisOriginal)})
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Simulação com Selic constante, parcelas {rf.sistema} e IR pela tabela regressiva
              conforme o tempo de aplicação. A comparação soma juros até a quitação de cada
              estratégia; não projeta patrimônio após quitar nem reinveste parcelas poupadas.
              Não inclui TR, seguros ou tarifas. Confirme as condições de amortização com o banco.
              A Selic muda a cada Copom; os resultados não são garantidos e não constituem
              recomendação de investimento.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
