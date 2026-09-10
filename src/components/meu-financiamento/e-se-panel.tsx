'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { simulate } from '@/lib/finance/engine';
import { economiaDoAporte } from '@/lib/finance/meu-financiamento/economia';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import type { ContractParams, Projecao } from '@/lib/finance/meu-financiamento/model';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatBRL } from '@/lib/utils';

/** Aporte cujo efeito total (prazo ou total pago) fica abaixo disso é tratado como nenhum. */
const LIMIAR_EFEITO = 0.01;
const BUSCA_MAX_ITERACOES = 100;
const BUSCA_CAP_VEZES = 5;

type TipoAporte = 'pontual' | 'mensal';
type ModoReducao = 'term' | 'payment';

type Trecho = { tipo: 'texto' | 'numero'; valor: string };

interface ResultadoEfeito {
  tipo: 'efeito';
  linhas: Trecho[][];
  economia: number;
  /** Falso quando o valor da economia já vem embutido em uma linha (nada mudou além dos juros). */
  comCaixaEconomia: boolean;
}

interface ResultadoHonesto {
  tipo: 'honesto';
  minimo: number | null;
  testadoAte: number;
}

type Resultado = ResultadoEfeito | ResultadoHonesto;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function txt(texto: string): Trecho {
  return { tipo: 'texto', valor: texto };
}

function numero(valor: string): Trecho {
  return { tipo: 'numero', valor };
}

/** Mesmo LoanInput base dos cenários: saldo efetivo atual, parcelas ainda não pagas. */
function baseLoanInput(params: ContractParams, projecao: Projecao): LoanInput {
  return {
    bank: params.bank,
    system: params.system,
    principal: projecao.saldoEfetivo,
    months: params.parcelasTotais - projecao.primeiraPendente + 1,
    annualRate: params.annualRate,
    trMonthly: params.trMonthly,
    insuranceMonthly: params.insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
  };
}

/**
 * Parcela do contrato em que a simulação quita, com a mesma fusão da parcela
 * fantasma do model (engine PRICE com TR paga months+1 e o model funde na
 * última parcela do prazo). O painel ancora a comparação na quitação exibida
 * pelo dashboard (`projecao.quitaEm`), que o model pode encurtar por
 * amortizações term registradas: o cenário nunca "quita depois" dela, então a
 * parcela final é limitada a Y no chamador.
 */
function parcelaDeQuitacao(cenario: SimulationResult, mesesDoCenario: number, primeiraPendente: number): number {
  if (cenario.installments.length > mesesDoCenario) return primeiraPendente + mesesDoCenario - 1;
  return primeiraPendente + cenario.installments.length - 1;
}

/** Primeira parcela (2ª em diante) em que o modo payment recalcula a parcela contratual para baixo. */
function parcelaReduzida(cenario: SimulationResult, base: SimulationResult): number | null {
  for (let i = 1; i < cenario.installments.length; i += 1) {
    const contratual = cenario.installments[i].parcela - cenario.installments[i].extra;
    const baseParcela = base.installments[i]?.parcela ?? Infinity;
    if (contratual < baseParcela - 0.5) return contratual;
  }
  return null;
}

function estrategiasPontual(valor: number): Strategies {
  return { extraLumpSum: [{ month: 1, amount: valor }], reduceMode: 'term' };
}

function estrategiasMensal(parcelaAtual: number, valor: number, modo: ModoReducao): Strategies {
  return {
    extraLumpSum: [],
    fixedPayment: {
      amount: round2(parcelaAtual + valor),
      reduceMode: modo,
    },
    reduceMode: modo,
  };
}

/**
 * Menor valor (na grade de centavos) a partir do aporte informado que muda o
 * prazo (quitação abaixo da exibida pelo dashboard) ou o total pago em mais de
 * um centavo. Busca linear limitada: passos de um centavo (ou 25% do aporte
 * para valores grandes), até 5x o aporte. A economia vem de `economiaDe`, o
 * mesmo helper (`economiaDoAporte`) usado pela sugestão de amortização.
 */
function buscarMinimoComEfeito(
  cenarioDe: (valor: number) => SimulationResult,
  economiaDe: (valor: number) => number,
  aporte: number,
  quitaEmProjecao: number,
  meses: number,
  primeiraPendente: number,
): { minimo: number | null; testadoAte: number } {
  const passo = Math.max(0.01, round2(aporte * 0.25));
  const limite = Math.max(aporte + 0.01, round2(aporte * BUSCA_CAP_VEZES));
  let minimo: number | null = null;
  let testadoAte = aporte;
  let valor = aporte;
  for (let i = 0; i < BUSCA_MAX_ITERACOES; i += 1) {
    valor = round2(valor + passo);
    if (valor > limite) break;
    testadoAte = valor;
    const cenario = cenarioDe(valor);
    const quita = Math.min(parcelaDeQuitacao(cenario, meses, primeiraPendente), quitaEmProjecao);
    const economia = economiaDe(valor);
    if (quita < quitaEmProjecao || economia > LIMIAR_EFEITO) {
      minimo = valor;
      break;
    }
  }
  return { minimo, testadoAte };
}

function LinhaResultado({ trechos }: { trechos: Trecho[] }) {
  return (
    <p className="text-sm">
      {trechos.map((trecho, i) =>
        trecho.tipo === 'numero' ? (
          <strong key={i} className="font-mono font-semibold tabular-nums">
            {trecho.valor}
          </strong>
        ) : (
          <span key={i}>{trecho.valor}</span>
        ),
      )}
    </p>
  );
}

/**
 * Painel "E se?" do dashboard: um cenário por vez (aporte pontual no mês 1 ou
 * aporte mensal fixo reduzindo prazo ou parcela) sobre o contrato real, com a
 * engine pura nos dois lados da comparação (sem server action).
 */
export function EsePanel({ params, projecao }: { params: ContractParams; projecao: Projecao }) {
  const [tipo, setTipo] = useState<TipoAporte>('pontual');
  const [aportePontual, setAportePontual] = useState(0);
  const [aporteMensal, setAporteMensal] = useState(0);
  const [modo, setModo] = useState<ModoReducao>('term');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  const { quitaEm, primeiraPendente } = projecao;
  const meses = params.parcelasTotais - primeiraPendente + 1;
  const parcelaAtual = projecao.parcelas[0]?.parcela ?? 0;

  if (quitaEm === null) {
    return (
      <Card className="flex w-full min-w-0 flex-col rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle role="heading" aria-level={3} className="flex items-center gap-2 text-lg">
            <Zap className="size-5 text-[#820AD1]" /> E se?
          </CardTitle>
          <CardDescription>Simule um aporte extra no seu contrato e veja o efeito no prazo e no total pago.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-3">
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Este contrato não quita dentro do prazo no modelo, então não há quitação para comparar. Confira o saldo no
            extrato e recalibre para tentar de novo.
          </p>
          <p className="text-xs text-muted-foreground">
            Estimativa do modelo: TR e seguro constantes. Confira o saldo no extrato e recalibre quando fizer uma
            amortização.
          </p>
        </CardContent>
      </Card>
    );
  }

  const aporte = tipo === 'pontual' ? aportePontual : aporteMensal;

  function recalcular() {
    setError('');
    const Y = quitaEm;
    // O formulário só existe com quitação projetada (guard acima), mas a
    // função não carrega o estreitamento de tipo do render.
    if (Y === null) return;
    if (aporte <= 0) {
      setError(tipo === 'pontual' ? 'Informe o valor do aporte extra (maior que zero).' : 'Informe o valor do aporte mensal (maior que zero).');
      setResultado(null);
      return;
    }
    const input = baseLoanInput(params, projecao);
    const base = simulate(input);
    // Baseline do PageState: a quitação exibida pelo dashboard, que o model já
    // encurtou por amortizações term registradas (mesesParaParcela).
    const estrategiasDe = tipo === 'pontual'
      ? estrategiasPontual
      : (valor: number) => estrategiasMensal(parcelaAtual, valor, modo);
    // Aporte pontual usa o helper compartilhado com a sugestão (métrica
    // idêntica por construção); o aporte mensal (fixedPayment) não é lump sum.
    const economiaDe = tipo === 'pontual'
      ? (valor: number) => economiaDoAporte(input, valor, 'term')
      : (valor: number) => Math.max(0, base.metrics.totalPago - simulate(input, estrategiasDe(valor)).metrics.totalPago);

    try {
      const cenario = simulate(input, estrategiasDe(aporte));
      // Cenário nunca quita depois do que o model já projetou para o estado.
      const quita = Math.min(parcelaDeQuitacao(cenario, meses, primeiraPendente), Y);
      const economia = economiaDe(aporte);

      if (quita === Y && economia <= LIMIAR_EFEITO) {
        const busca = buscarMinimoComEfeito((valor) => simulate(input, estrategiasDe(valor)), economiaDe, aporte, Y, meses, primeiraPendente);
        setResultado({ tipo: 'honesto', minimo: busca.minimo, testadoAte: busca.testadoAte });
        return;
      }

      const reduzida = tipo === 'mensal' && modo === 'payment' ? parcelaReduzida(cenario, base) : null;
      const linhas: Trecho[][] = [];
      let comCaixaEconomia = true;
      if (quita < Y) {
        linhas.push([txt('Quita na parcela '), numero(String(quita)), txt(' em vez de '), numero(String(Y)), txt('.')]);
        if (tipo === 'mensal' && modo === 'payment') {
          if (reduzida !== null) {
            linhas.push([
              txt('Parcela cai para '),
              numero(formatBRL(reduzida)),
              txt(' a partir do próximo mês.'),
            ]);
          } else {
            linhas.push([
              txt('Com '),
              numero(formatBRL(aporte)),
              txt(' mensais o modelo não reduz a parcela projetada; o aporte apenas antecipa a quitação. Aumente o aporte para reduzir a parcela.'),
            ]);
          }
        }
      } else if (reduzida !== null) {
        linhas.push([txt('Quitação mantida na parcela '), numero(String(Y)), txt('.')]);
        linhas.push([
          txt('Parcela cai para '),
          numero(formatBRL(reduzida)),
          txt(' a partir do próximo mês.'),
        ]);
      } else if (economia > LIMIAR_EFEITO) {
        // Nada mudou além dos juros: prazo e parcela continuam iguais.
        linhas.push([
          txt('Prazo e parcela não mudam neste cenário; a economia de '),
          numero(formatBRL(economia)),
          txt(' vem só dos juros.'),
        ]);
        comCaixaEconomia = false;
      }
      setResultado({ tipo: 'efeito', linhas, economia, comCaixaEconomia });
    } catch {
      setError('Não foi possível simular este cenário. Confira os valores e tente de novo.');
    }
  }

  return (
    <Card className="flex w-full min-w-0 flex-col rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={3} className="flex items-center gap-2 text-lg">
          <Zap className="size-5 text-[#820AD1]" /> E se?
        </CardTitle>
        <CardDescription>Simule um aporte extra no seu contrato e veja o efeito no prazo e no total pago.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <RadioGroup
          value={tipo}
          onValueChange={(v) => {
            setTipo(v as TipoAporte);
            setResultado(null);
            setError('');
          }}
          aria-label="Tipo de aporte"
          className="flex flex-wrap gap-x-6 gap-y-2"
        >
          <label className="flex items-center gap-1.5 text-sm">
            <RadioGroupItem value="pontual" />
            Aporte pontual
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <RadioGroupItem value="mensal" />
            Aporte mensal
          </label>
        </RadioGroup>

        {tipo === 'pontual' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="aporteExtra" className="text-sm font-medium text-foreground">
              Aporte extra (R$)
            </label>
            <MoneyInput
              id="aporteExtra"
              value={aportePontual}
              onValid={(v) => {
                setAportePontual(v);
                setResultado(null);
                setError('');
              }}
              className="max-w-56"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="aporteMensal" className="text-sm font-medium text-foreground">
                Aporte mensal (R$)
              </label>
              <MoneyInput
                id="aporteMensal"
                value={aporteMensal}
                onValid={(v) => {
                  setAporteMensal(v);
                  setResultado(null);
                  setError('');
                }}
                className="max-w-56"
              />
            </div>
            <RadioGroup
              value={modo}
              onValueChange={(v) => {
                setModo(v as ModoReducao);
                setResultado(null);
              }}
              aria-label="Modo de redução do aporte mensal"
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="term" />
                Reduzir prazo
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="payment" />
                Reduzir parcela
              </label>
            </RadioGroup>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div>
          <Button type="button" onClick={recalcular} disabled={aporte <= 0}>
            Calcular
          </Button>
        </div>

        {resultado && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
            {resultado.tipo === 'honesto' ? (
              <>
                {resultado.minimo !== null ? (
                  <p className="text-sm">
                    Este valor não muda prazo nem parcela no modelo; o mínimo com efeito é{' '}
                    <strong className="font-mono font-semibold tabular-nums">{formatBRL(resultado.minimo)}</strong>.
                  </p>
                ) : (
                  <p className="text-sm">
                    O modelo não encontra efeito para valores até{' '}
                    <strong className="font-mono font-semibold tabular-nums">{formatBRL(resultado.testadoAte)}</strong>.
                    Confira o saldo no extrato e recalibre quando fizer uma amortização.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {resultado.linhas.map((trechos, i) => (
                    <LinhaResultado key={i} trechos={trechos} />
                  ))}
                </div>
                {resultado.comCaixaEconomia && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">Economia estimada</span>
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {formatBRL(resultado.economia)}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Economia do modelo: total a pagar do contrato atual menos o total a pagar do cenário, simulados do
                  mesmo jeito.
                </p>
              </>
            )}
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
