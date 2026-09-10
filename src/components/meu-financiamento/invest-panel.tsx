'use client';

import { useState } from 'react';
import { Scale, Info } from 'lucide-react';
import {
  calcularInvestOuAmortizar,
  type CenarioId,
  type InvestResult,
} from '@/lib/finance/invest-ou-amortizar';
import type { ContractParams, Projecao } from '@/lib/finance/meu-financiamento/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { formatBRL, parseDecimal } from '@/lib/utils';

const SELIC_FALLBACK = 10.5;

/** Percentual por extenso curto (ex.: "10,50% a.a.") para a descrição do cenário. */
function pctAnual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`;
}

interface Veredito {
  vencedor: 'amortizar' | 'investir';
  diferenca: number;
  amortizarJuros: number;
  investirJuros: number;
}

/**
 * Veredito do painel: compara a melhor estratégia de amortização com investir
 * pelo que sobra no fim (juros economizados + dinheiro que permanece no bolso,
 * na conta do modelo). Investir sempre mantém o valor aplicado.
 */
function vereditoDe(resultado: InvestResult, valor: number): Veredito {
  const amortizarJuros = Math.max(
    resultado.estrategias['reduzir-parcela'].economiaJuros,
    resultado.estrategias['reduzir-prazo'].economiaJuros,
  );
  const investirJuros = resultado.estrategias['investir-rendimento'].economiaJuros;
  const amortizarTotal = amortizarJuros;
  const investirTotal = investirJuros + valor;
  return {
    vencedor: amortizarTotal >= investirTotal ? 'amortizar' : 'investir',
    diferenca: Math.abs(amortizarTotal - investirTotal),
    amortizarJuros,
    investirJuros,
  };
}

function EstrategiaCard({
  cenario,
  resultado,
  valor,
  sistema,
  rendimentoPct,
  amortizacaoMensal,
}: {
  cenario: CenarioId;
  resultado: InvestResult;
  valor: number;
  sistema: 'PRICE' | 'SAC';
  rendimentoPct: number;
  amortizacaoMensal: number;
}) {
  const c = resultado.estrategias[cenario];
  const vencedor = resultado.melhorEconomia === cenario;
  const titulos: Record<CenarioId, string> = {
    'reduzir-parcela': 'Reduzir a parcela',
    'reduzir-prazo': 'Reduzir o prazo',
    'investir-rendimento': 'Investir e amortizar com o rendimento',
  };
  const descricoes: Record<CenarioId, string> = {
    'reduzir-parcela': `Você abate ${formatBRL(valor)} da dívida e a parcela cai de ${formatBRL(resultado.parcelaOriginal)} para ${formatBRL(c.parcela ?? 0)} (${sistema}). O prazo continua o mesmo.${sistema === 'SAC' ? ' Valores do primeiro mês; a nova amortização é constante e as parcelas caem com os juros.' : ''}`,
    'reduzir-prazo': sistema === 'SAC'
      ? `Você abate ${formatBRL(valor)} e mantém a amortização contratual de ${formatBRL(amortizacaoMensal)}/mês. Os juros incidem sobre o saldo reduzido; a parcela não fica fixa e o prazo diminui.`
      : `Você abate ${formatBRL(valor)} e mantém o pagamento de ${formatBRL(resultado.parcelaOriginal)} até quitar, reduzindo o prazo.`,
    'investir-rendimento': `Os ${formatBRL(valor)} ficam investidos na Selic (${pctAnual(rendimentoPct)}) e o rendimento líquido mensal amortiza a dívida, sem reinvestir os rendimentos.`,
  };
  return (
    <Card
      className={`min-w-0 rounded-2xl shadow-sm ${vencedor ? 'ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : ''}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {titulos[cenario]}
          {vencedor && (
            <Badge variant="secondary" className="text-xs">
              Maior economia
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="break-words">{descricoes[cenario]}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Quita a dívida em</span>
          <span className="font-mono font-semibold tabular-nums">
            {c.quitaEmMeses === null
              ? 'mais de 600 meses'
              : c.quitaEmMeses === 0
                ? 'Hoje'
                : `${c.quitaEmMeses} ${c.quitaEmMeses === 1 ? 'mês' : 'meses'}`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Juros totais do contrato</span>
          <span className="font-mono font-semibold tabular-nums">{formatBRL(c.jurosTotais)}</span>
        </div>
        {c.mantemPrincipal && (
          <div className="rounded-xl border border-[#820AD1]/40 bg-primary/[0.04] px-3 py-2">
            <span className="text-xs text-muted-foreground">No fim das contas, você ainda tem</span>
            <span className="block font-mono text-xl font-bold tabular-nums text-[#820AD1] dark:text-[#a44ce0]">
              {formatBRL(valor)}
            </span>
            <span className="text-xs text-muted-foreground">O valor continua investido.</span>
          </div>
        )}
        <div className="border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Economia de juros até quitar</span>
          <span className="block font-mono text-2xl font-bold tabular-nums text-[#820AD1] dark:text-[#a44ce0]">
            {formatBRL(c.economiaJuros)}
          </span>
          <span className="text-xs text-muted-foreground">
            {(resultado.jurosTotaisOriginal > 0 ? (c.economiaJuros / resultado.jurosTotaisOriginal) * 100 : 0).toFixed(0)}%
            dos juros do contrato original ({formatBRL(resultado.jurosTotaisOriginal)})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Painel "Investir ou amortizar" do dashboard: reusa a calculadora
 * `/investir-ou-amortizar` com os valores reais do contrato (saldo efetivo,
 * taxa e sistema), com os mesmos avisos de IR, Selic e TR/seguro constantes.
 */
export function InvestPanel({
  params,
  projecao,
  selicAnnual,
}: {
  params: ContractParams;
  projecao: Projecao;
  selicAnnual: number | null;
}) {
  const meses = params.parcelasTotais - projecao.primeiraPendente + 1;
  const saldo = projecao.saldoEfetivo;
  const [valor, setValor] = useState(0);
  const [rendimento, setRendimento] = useState(selicAnnual ?? SELIC_FALLBACK);
  const [prazoAnos, setPrazoAnos] = useState(Math.max(1, Math.round(meses / 12)));
  const [resultado, setResultado] = useState<InvestResult | null>(null);
  const [error, setError] = useState('');

  const veredito = resultado ? vereditoDe(resultado, valor) : null;

  function calcular() {
    setError('');
    if (!(valor > 0)) {
      setResultado(null);
      setError('Informe o valor disponível (maior que zero).');
      return;
    }
    if (valor > saldo) {
      setResultado(null);
      setError('O valor disponível não pode superar o saldo devedor.');
      return;
    }
    if (!Number.isFinite(rendimento) || rendimento < 0) {
      setResultado(null);
      setError('Informe um rendimento da aplicação válido.');
      return;
    }
    const anos = Number(prazoAnos);
    if (!Number.isSafeInteger(anos) || anos < 1) {
      setResultado(null);
      setError('Prazo da comparação deve ser um número inteiro de anos maior que zero.');
      return;
    }
    try {
      setResultado(
        calcularInvestOuAmortizar({
          saldoDevedor: saldo,
          prazoRestanteMeses: meses,
          taxaFinanciamento: params.annualRate,
          valorDisponivel: valor,
          selicAnual: rendimento / 100,
          horizonteMeses: Math.min(anos * 12, meses),
          sistema: params.system,
        }),
      );
    } catch {
      setResultado(null);
      setError('Não foi possível calcular a comparação. Confira os valores e tente de novo.');
    }
  }

  return (
    <Card className="flex w-full min-w-0 flex-col rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={3} className="flex items-center gap-2 text-lg">
          <Scale className="size-5 text-[#820AD1]" /> Investir ou amortizar
        </CardTitle>
        <CardDescription className="break-words">
          Com dinheiro disponível hoje, compare investir na Selic com amortizar este contrato ({pctAnual(params.annualRate * 100)}{' '}
          {params.system === 'SAC' ? 'no SAC' : 'no PRICE'}).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Simulação com a Selic de hoje; ela muda a cada reunião do Copom. Não é recomendação de investimento.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invPValor" className="text-sm font-medium text-foreground">
              Valor disponível (R$)
            </label>
            <MoneyInput
              id="invPValor"
              value={valor}
              onValid={(v) => {
                setValor(v);
                setResultado(null);
                setError('');
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invPRendimento" className="text-sm font-medium text-foreground">
              Rendimento da aplicação (% a.a.)
            </label>
            <NumericInput
              id="invPRendimento"
              value={rendimento}
              parse={parseDecimal}
              onValid={(v) => {
                setRendimento(v);
                setResultado(null);
                setError('');
              }}
            />
            <p className="text-xs text-muted-foreground">
              {selicAnnual !== null
                ? 'Já vem preenchida com a Selic atual do BACEN; ajuste se quiser simular outro cenário.'
                : 'Selic de referência não disponível agora; o valor padrão de 10,5% a.a. foi usado.'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invPPrazo" className="text-sm font-medium text-foreground">
              Prazo da comparação (anos)
            </label>
            <NumericInput
              id="invPPrazo"
              value={prazoAnos}
              parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))}
              onValid={(v) => {
                setPrazoAnos(v);
                setResultado(null);
                setError('');
              }}
            />
            <p className="text-xs text-muted-foreground">
              O contrato tem {Math.floor(meses / 12)} ano{Math.floor(meses / 12) === 1 ? '' : 's'} de prazo restante
              ({meses} parcelas).
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div>
          <Button type="button" onClick={calcular} disabled={!(valor > 0)}>
            Comparar
          </Button>
        </div>

        {resultado && veredito && (
          <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
            <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-5">
              <p className="text-xl font-semibold break-words">
                {veredito.vencedor === 'amortizar' ? 'Amortizar' : 'Investir'} deixa você{' '}
                <span className="font-mono tabular-nums">{formatBRL(veredito.diferenca)}</span> à frente
              </p>
              <div className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
                <p className="break-words">
                  Amortizar economiza{' '}
                  <strong className="font-mono tabular-nums text-foreground">
                    {formatBRL(veredito.amortizarJuros)}
                  </strong>{' '}
                  de juros, mas usa os {formatBRL(valor)} no abate.
                </p>
                <p className="break-words">
                  Investir economiza{' '}
                  <strong className="font-mono tabular-nums text-foreground">
                    {formatBRL(veredito.investirJuros)}
                  </strong>{' '}
                  de juros e você termina com{' '}
                  <strong className="font-mono tabular-nums text-foreground">{formatBRL(valor)}</strong> ainda no bolso.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Conta do modelo: juros economizados até quitar mais o dinheiro que sobra. Não considera reinvestir as
                parcelas poupadas nem mudanças futuras da Selic.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {(['reduzir-parcela', 'reduzir-prazo', 'investir-rendimento'] as CenarioId[]).map((cenario) => (
                <EstrategiaCard
                  key={cenario}
                  cenario={cenario}
                  resultado={resultado}
                  valor={valor}
                  sistema={params.system}
                  rendimentoPct={rendimento}
                  amortizacaoMensal={saldo / meses}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Simulação com Selic constante, parcelas {params.system} e IR pela tabela regressiva conforme o tempo de
              aplicação. A comparação soma juros até a quitação de cada estratégia e não projeta patrimônio depois de
              quitar nem reinveste parcelas poupadas. Não inclui TR, seguros ou tarifas; os juros do financiamento usam
              a taxa efetiva do contrato. Confirme as condições de amortização com o banco. A decisão depende do seu
              perfil e da sua capacidade de manter o plano.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Estimativa do modelo: TR e seguro constantes. Confira o saldo no extrato e recalibre quando fizer uma
          amortização.
        </p>
      </CardContent>
    </Card>
  );
}
