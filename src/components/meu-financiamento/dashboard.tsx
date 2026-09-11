'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  FilePen,
  Landmark,
  ListChecks,
  PiggyBank,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { CompareChart } from '@/components/simulation/charts/CompareChart';
import { ExclusiveCard } from '@/components/exclusive-card';
import { deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { PageState } from '@/lib/meu-financiamento/repo';
import { addMonthsISO, formatDataBr, formatMesAno, todayISO } from '@/lib/meu-financiamento/dates';
import { economiaAcumulada, economiaAmortizacoes } from '@/lib/finance/meu-financiamento/economia';
import { projecao as projetar } from '@/lib/finance/meu-financiamento/model';
import { formatBRL, numberToBRLInput } from '@/lib/utils';
import { DEFAULT_FORM, SIM_INPUT_KEY, type FormState } from '@/lib/simulation-context';
import { PayInstallmentDialog } from './pay-installment';
import { RecalibrateDialog } from './recalibrate-dialog';
import { EditContractDialog } from './edit-contract-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { ParcelasDoFinanciamento } from './parcelas-do-financiamento';
import { SugestaoAmortizacao } from './sugestao-amortizacao';
import { EsePanel } from './e-se-panel';
import { InvestPanel } from './invest-panel';

const DIVERGENCIA_BANNER_LIMITE = 200;

/** Destaque principal da faixa "Visão global": número grande em mono tabular,
 *  com ícone e legenda própria. O `dt` e o `dd` ficam irmãos no container para
 *  o locator do E2E (`getByText(label).locator('..')`) ler o valor. */
function DestaqueGlobal({
  icon: Icon,
  label,
  valor,
  caption,
  tone = 'primary',
}: {
  icon: typeof Wallet;
  label: string;
  valor: ReactNode;
  caption?: string;
  tone?: 'primary' | 'emerald';
}) {
  const emerald = tone === 'emerald';
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={
          emerald
            ? 'shrink-0 rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400'
            : 'shrink-0 rounded-lg bg-[#820AD1]/10 p-2 text-[#820AD1]'
        }
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd
          className={
            emerald
              ? 'font-mono text-2xl font-semibold tabular-nums break-words text-emerald-600 dark:text-emerald-400 sm:text-3xl'
              : 'font-mono text-2xl font-semibold tabular-nums break-words sm:text-3xl'
          }
        >
          {valor}
        </dd>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </div>
    </div>
  );
}

/** Métrica secundária da faixa "Visão global": menor que o destaque e com
 *  ícone discreto. Mantém o par `dt`/`dd` irmãos para o locator do E2E. */
function MetricaGlobal({
  icon: Icon,
  label,
  valor,
  caption,
}: {
  icon: typeof Wallet;
  label: string;
  valor: ReactNode;
  caption?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="font-mono text-lg font-semibold tabular-nums break-words">{valor}</dd>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </div>
    </div>
  );
}

export function Dashboard({
  state,
  readOnly = false,
  selicAnnual = null,
}: {
  state: PageState;
  /** Modo somente leitura (leitura congelada): a página passa true quando o
   *  contrato existe e o plano Ilimitado expirou (sem ações, com paywall). */
  readOnly?: boolean;
  /** Selic anual do BACEN para o painel investir ou amortizar; null usa o padrão. */
  selicAnnual?: number | null;
}) {
  const router = useRouter();
  const { params, baseline, pagas, extras, projecao } = state;
  const { parcelas, quitaEm, divergencia, saldoEfetivo, primeiraPendente } = projecao;
  const primeiraProjetada = parcelas[0] ?? null;
  const [pay, setPay] = useState<{
    parcelaNumero: number;
    defaultValor: number;
    vencimento: string;
    aporte?: number;
  } | null>(null);
  const [recalibrando, setRecalibrando] = useState(false);
  const [editandoContrato, setEditandoContrato] = useState(false);
  const [ultimaPaga, setUltimaPaga] = useState<{ numero: number } | null>(null);
  const [desfazerAlvo, setDesfazerAlvo] = useState<{ id: string; numero: number; valor: number } | null>(null);

  const quitado = state.quitado;
  const hoje = todayISO();
  const diaVencimento = baseline.diaVencimento ?? Number(baseline.dataBase.slice(8, 10));

  const vencimentoEstimado = (parcelaNumero: number) =>
    addMonthsISO(baseline.dataBase, parcelaNumero - baseline.proximaParcelaNumero, diaVencimento);

  const quitaEmData = quitaEm != null
    ? addMonthsISO(baseline.dataBase, quitaEm - baseline.proximaParcelaNumero, diaVencimento)
    : null;

  const vencimentoPrimeira = primeiraProjetada ? vencimentoEstimado(primeiraProjetada.parcelaNumero) : null;
  const vencida = vencimentoPrimeira != null && vencimentoPrimeira < hoje;
  // Clamp defensivo 0..100: dado legado fora da faixa não pode estourar a
  // largura da barra nem divergir do aria-valuenow.
  const pctContrato = params.parcelasTotais > 0
    ? Math.min(100, Math.max(0, Math.round(((primeiraPendente - 1) / params.parcelasTotais) * 100)))
    : 0;

  // Total pago usa o HISTÓRICO completo: recalibração/atualização congelam o
  // passado, mas os lançamentos continuam visíveis e somando.
  const totalPago = state.historico.pagas.reduce((soma, p) => soma + p.valor, 0)
    + state.historico.extras.reduce((soma, e) => soma + e.valor, 0);

  // Total amortizado em extras, no histórico completo (todos os períodos).
  const totalAmortizado = state.historico.extras.reduce((soma, e) => soma + e.valor, 0);

  // Economia ACUMULADA: soma a economia de cada período do contrato. Usar o
  // histórico (e não só os extras vigentes) preserva o acumulado após edições,
  // que congelam as amortizações antigas no baseline anterior.
  const economia = economiaAcumulada(state.states, state.historico);
  const economiaPositiva = Math.round(economia * 100) > 0;

  // Faixa GLOBAL: somatórios de todos os períodos, independentes de edições e
  // portabilidades. O valor original vem do primeiro baseline (versão 1).
  const pagamentosRegistrados = state.historico.pagas.length;
  const estadoInicial = state.states[0];
  const valorOriginal = estadoInicial ? estadoInicial.saldoDevedor : baseline.saldoDevedor;

  // Barra de CAPITAL do global: pago = valor original menos o saldo efetivo
  // atual; a largura usa a fração paga (clamp 0..100) e o `pago` exibido nunca
  // é negativo (o saldo pode subir por TR/correção no início).
  const pagoOriginal = valorOriginal - saldoEfetivo;
  const pagoOriginalExibido = Math.max(0, pagoOriginal);
  const pctPagoOriginal = valorOriginal > 0
    ? Math.min(100, Math.max(0, Math.round((pagoOriginal / valorOriginal) * 100)))
    : null;

  // Resumo em uma linha do acumulado do contrato. O percentual é o capital
  // quitado (original menos saldo) clampado 0..100.
  const resumoGlobal = valorOriginal > 0
    ? `Você financiou ${formatBRL(valorOriginal)} e já pagou ${formatBRL(totalPago)} (${formatBRL(totalAmortizado)} em amortizações). Faltam ${formatBRL(saldoEfetivo)} do valor original; já quitou ${pctPagoOriginal ?? 0}%.`
    : `Você já pagou ${formatBRL(totalPago)} (${formatBRL(totalAmortizado)} em amortizações).`;

  // Estatísticas da SITUAÇÃO ATUAL: usam só os extras do estado vigente (os
  // períodos superados já foram incorporados ao saldo do baseline novo).
  const amortizadoVigente = extras.reduce((soma, extra) => soma + extra.valor, 0);
  const economiaVigente = economiaAmortizacoes(params, baseline, pagas, extras);
  const economiaVigentePositiva = Math.round(economiaVigente * 100) > 0;
  const semAmortizacoesVigentes = extras.length === 0;

  // Seção "Contratado vs real": o cenário CONTRATADO é o estado vigente SEM as
  // amortizações extras (quita no prazo original); o REAL é a projeção vigente
  // (state.projecao). Só calcula o contratado quando há extras: sem eles os dois
  // cenários seriam idênticos. Ambas as curvas começam no saldo atual (antes das
  // extras no contratado, saldoEfetivo no real) para deixar a divergência clara.
  const projecaoContratada = useMemo(
    () => (extras.length > 0 ? projetar(params, baseline, pagas, []) : null),
    [extras.length, params, baseline, pagas],
  );
  const contratadoSaldos = useMemo(
    () =>
      projecaoContratada
        ? [projecaoContratada.saldoEfetivo, ...projecaoContratada.parcelas.map((p) => p.saldo)]
        : [],
    [projecaoContratada],
  );
  // Mesmo eixo de parcelas futuras das duas curvas: o ponto 0 é o saldo atual.
  const realSaldos = useMemo(() => [saldoEfetivo, ...parcelas.map((p) => p.saldo)], [saldoEfetivo, parcelas]);
  const compararCenarios = extras.length > 0 && contratadoSaldos.length > 1;

  // Confirmação só vale enquanto a parcela recém-paga existir no estado atual
  // (apagar pela tabela ou recalibrar some com a linha e com o Desfazer).
  const pagaConfirmada = ultimaPaga
    ? (pagas.find((p) => p.parcelaNumero === ultimaPaga.numero) ?? null)
    : null;

  async function desfazer(alvo: { id: string }) {
    const result = await deleteMovement(alvo.id);
    if (result.ok) {
      await router.refresh();
      setUltimaPaga(null);
    }
    return result;
  }

  // Transfere o cenário vigente para o simulador, no mesmo padrão de
  // SmartResultCard/comparator-result: principal = saldo efetivo, prazo =
  // parcelas restantes (parcelasTotais − primeiraPendente + 1), taxa efetiva
  // a.a. e demais campos default. É leitura/transferência: aparece também em
  // readOnly; em contrato quitado (saldo 0) fica desabilitado porque a engine
  // recusa principal zero.
  function levarAoSimulador() {
    const months = Math.max(1, params.parcelasTotais - primeiraPendente + 1);
    // Arredonda o percentual (x100) em 6 casas antes de stringificar: a
    // multiplicação por 100 introduz ruído de float (0,16999999999999998,
    // 7.000000000000001) que apareceria cru no input do simulador. Principal em
    // reais inteiros e seguro com 2 casas.
    const percent = (value: number) => String(Number((value * 100).toFixed(6)));
    const form: FormState = {
      ...DEFAULT_FORM,
      system: params.system,
      principal: String(Math.round(saldoEfetivo)),
      annualRate: percent(params.annualRate),
      months: String(months),
      trMonthly: percent(params.trMonthly),
      insuranceMonthly: numberToBRLInput(params.insuranceMonthly),
      bank: params.bank,
      annualRateKind: 'effective-annual',
      reduceMode: 'term',
    };
    sessionStorage.setItem(SIM_INPUT_KEY, JSON.stringify(form));
    router.push('/simulacao');
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Landmark className="size-3.5 text-[#820AD1]" />
          {params.bank} · {params.system} · Parcela {primeiraPendente} de {params.parcelasTotais}
        </p>
      </div>

      <section aria-label="Visão global" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-lg font-semibold">Visão global</h2>
          <p className="text-xs text-muted-foreground">
            desde o início do contrato, somando atualizações e portabilidades
          </p>
        </div>
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DestaqueGlobal
              icon={Target}
              label="Falta pagar"
              valor={formatBRL(saldoEfetivo)}
              caption="saldo devedor projetado"
            />
            <DestaqueGlobal
              icon={PiggyBank}
              label="Já economizado"
              valor={economiaPositiva ? formatBRL(economia) : '—'}
              caption={economiaPositiva ? 'juros, correção e seguro evitados' : 'registre amortizações'}
              tone="emerald"
            />
          </dl>

          <p className="text-sm text-muted-foreground">{resumoGlobal}</p>

          {pctPagoOriginal != null && (
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label="Capital pago em relação ao valor original"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pctPagoOriginal}
                className="h-2 w-full overflow-hidden rounded-full bg-[#820AD1]/10"
              >
                <div
                  className="h-full rounded-full bg-[#820AD1]"
                  style={{ width: `${pctPagoOriginal}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBRL(pagoOriginalExibido)} pago · {formatBRL(saldoEfetivo)} restante
              </p>
            </div>
          )}

          <dl className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
            <MetricaGlobal icon={Wallet} label="Total pago" valor={formatBRL(totalPago)} />
            <MetricaGlobal icon={TrendingUp} label="Amortizado" valor={formatBRL(totalAmortizado)} />
            <MetricaGlobal
              icon={ListChecks}
              label="Pagamentos registrados"
              valor={pagamentosRegistrados}
              caption="parcelas pagas nos períodos"
            />
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">Situação atual</h2>
          <p className="text-xs text-muted-foreground">situação vigente a partir da última atualização</p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-[#820AD1]/20 bg-primary/[0.04] p-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Saldo devedor atual</p>
            <p className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">{formatBRL(saldoEfetivo)}</p>
            <p className="text-xs text-muted-foreground">
              Parcela {primeiraPendente} de {params.parcelasTotais} · atualizado com a data-base{' '}
              {formatDataBr(baseline.dataBase)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-label="Progresso do contrato"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pctContrato}
              className="h-2 w-full overflow-hidden rounded-full bg-[#820AD1]/10"
            >
              <div className="h-full rounded-full bg-[#820AD1]" style={{ width: `${pctContrato}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>{pctContrato}% do contrato percorrido</p>
              <div className="flex items-baseline gap-1">
                <span>Quitação estimada</span>
                <span className="font-medium text-foreground">
                  {quitaEm != null && quitaEmData
                    ? `Parcela ${quitaEm} (${formatMesAno(quitaEmData)})`
                    : (quitado || saldoEfetivo === 0 ? '—' : 'não no prazo')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Próxima parcela</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {primeiraProjetada ? formatBRL(primeiraProjetada.parcela) : '—'}
              </p>
              {primeiraProjetada && (
                <p className="text-xs text-muted-foreground">
                  Parcela {primeiraPendente} de {params.parcelasTotais}
                  {vencida ? ' · vencida' : ''}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Amortizado nesta situação</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {amortizadoVigente > 0 ? formatBRL(amortizadoVigente) : '—'}
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Economizado nesta situação</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {economiaVigentePositiva ? formatBRL(economiaVigente) : '—'}
              </p>
            </div>
          </div>
          {semAmortizacoesVigentes && (
            <p className="text-xs text-muted-foreground">sem amortizações nesta situação</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#820AD1]/10 pt-4">
            <p className="text-xs text-muted-foreground">
              Leve o saldo, a taxa e o prazo restante para o simulador e teste aportes e comparações.
            </p>
            <Button
              type="button"
              onClick={levarAoSimulador}
              disabled={saldoEfetivo <= 0}
              title={saldoEfetivo <= 0 ? 'Sem saldo devedor para simular' : undefined}
              className="shrink-0"
            >
              Levar ao Simulador <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

      {!readOnly && !quitado && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-label="Recalibrar pelo extrato"
            aria-describedby="acao-recalibrar-desc"
            onClick={() => setRecalibrando(true)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[#820AD1]/50 hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="rounded-xl bg-[#820AD1]/10 p-2 text-[#820AD1]">
              <Landmark className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">Recalibrar pelo extrato</span>
              <span id="acao-recalibrar-desc" className="text-xs text-muted-foreground">
                Corrija o saldo devedor com o valor que aparece no banco.
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Editar contrato"
            aria-describedby="acao-editar-contrato-desc"
            onClick={() => setEditandoContrato(true)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[#820AD1]/50 hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="rounded-xl bg-[#820AD1]/10 p-2 text-[#820AD1]">
              <FilePen className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">Editar contrato</span>
              <span id="acao-editar-contrato-desc" className="text-xs text-muted-foreground">
                Portabilidade, nova taxa ou sistema, acordo de prazo. O passado fica congelado; informe o saldo do
                extrato.
              </span>
            </span>
          </button>
        </div>
      )}

      {quitado ? (
        <div
          data-state-banner
          role="status"
          className="flex flex-col gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p>Financiamento quitado</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Saldo zerado. O registro do contrato é mantido e os lançamentos anteriores à última recalibração ficam
              como histórico no banco. Se o extrato mostrar saldo, recalibre para reativar o acompanhamento.
            </p>
          </div>
          {!readOnly && (
            <Button type="button" onClick={() => setRecalibrando(true)}>
              Recalibrar saldo
            </Button>
          )}
        </div>
      ) : saldoEfetivo === 0 ? (
        <div
          data-state-banner
          role="alert"
          className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p>
              Seus lançamentos zeraram o saldo no modelo. Confira o valor no extrato do banco e recalibre.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              O contrato segue ativo: o zero pode ser um lançamento com valor maior que o devido.
            </p>
          </div>
          {!readOnly && (
            <Button type="button" onClick={() => setRecalibrando(true)}>
              Recalibrar saldo
            </Button>
          )}
        </div>
      ) : (
        Math.abs(divergencia) >= DIVERGENCIA_BANNER_LIMITE && (
          <div
            data-state-banner
            className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              Seus pagamentos divergem do modelo em {formatBRL(Math.abs(divergencia))}. Confira o saldo no extrato
              e recalibre.
            </p>
            {!readOnly && (
              <Button type="button" onClick={() => setRecalibrando(true)}>
                Recalibrar saldo
              </Button>
            )}
          </div>
        )
      )}

      {!quitado && primeiraProjetada && (
        <section
          data-month-action
          className="flex flex-col gap-4 rounded-2xl border border-[#820AD1]/40 bg-card p-5 shadow-sm sm:p-6"
        >
          {!readOnly && pagaConfirmada && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <p>
                Parcela {pagaConfirmada.parcelaNumero} paga em {formatDataBr(pagaConfirmada.dataPagamento)} ·{' '}
                <span className="font-mono tabular-nums">{formatBRL(pagaConfirmada.valor)}</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setDesfazerAlvo({
                    id: pagaConfirmada.id,
                    numero: pagaConfirmada.parcelaNumero,
                    valor: pagaConfirmada.valor,
                  })
                }
              >
                Desfazer
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold">
              {vencida ? 'Parcela em aberto' : 'Sua parcela deste mês'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              Parcela {primeiraPendente} de {params.parcelasTotais}
            </p>
            <p className="text-xs text-muted-foreground">
              Vencimento estimado: {vencimentoPrimeira ? formatDataBr(vencimentoPrimeira) : '—'}
              {vencida ? ' (vencida)' : ''}
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
              {formatBRL(primeiraProjetada.parcela)}
            </p>
            {!readOnly && (
              <Button
                type="button"
                onClick={() =>
                  setPay({
                    parcelaNumero: primeiraProjetada.parcelaNumero,
                    defaultValor: primeiraProjetada.parcela,
                    vencimento: vencimentoPrimeira ?? hoje,
                  })
                }
              >
                Paguei esta parcela
              </Button>
            )}
          </div>
          {!readOnly && (
            <>
              <div className="border-t border-border/60" />
              <SugestaoAmortizacao
                params={params}
                baseline={baseline}
                pagas={pagas}
                extras={extras}
                projecao={projecao}
                onAplicar={(aporte) => {
                  setPay({
                    parcelaNumero: primeiraProjetada.parcelaNumero,
                    defaultValor: primeiraProjetada.parcela,
                    vencimento: vencimentoPrimeira ?? hoje,
                    aporte,
                  });
                }}
              />
            </>
          )}
        </section>
      )}

      {readOnly && !quitado && (
        // Leitura congelada: um único ExclusiveCard ocupa o lugar das ações
        // (Paguei, editar/apagar, Registrei amortização, Recalibrar saldo e
        // painéis de recomendação). Nenhum formulário é montado em readOnly;
        // a proteção real continua no servidor (requireUnlimited).
        <ExclusiveCard
          isUnlimited={state.isUnlimited}
          benefit="Registre boletos pagos, amortizações extras e recalibre o saldo pelo extrato do banco."
        />
      )}
      </section>

      <ParcelasDoFinanciamento state={state} readOnly={readOnly} quitado={quitado} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">Contratado vs real</h2>
          <p className="text-xs text-muted-foreground">
            {compararCenarios
              ? 'Estimativa do modelo a partir do saldo atual: quanto você pagaria sem amortizações e o que está acontecendo com elas.'
              : parcelas.length > 0
                ? 'Estimativa do modelo a partir do saldo atual. Registre uma amortização extra para comparar o contratado com o real.'
                : 'Sem parcelas futuras para projetar neste momento.'}
          </p>
        </div>
        {compararCenarios ? (
          <div className="flex min-w-0 flex-col gap-2">
            <CompareChart
              base={contratadoSaldos}
              withStrategy={realSaldos}
              baseName="Contratado (sem amortizações)"
              strategyName="Real (com suas amortizações)"
            />
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-2 w-4 shrink-0 rounded-full bg-[#9CA3AF]" aria-hidden />
                Contratado (sem amortizações)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-4 shrink-0 rounded-full bg-[#820AD1]" aria-hidden />
                Real (com suas amortizações)
              </li>
            </ul>
          </div>
        ) : parcelas.length > 0 ? (
          <BalanceChart data={parcelas.map((p) => ({ month: p.parcelaNumero, saldo: p.saldo }))} />
        ) : null}
      </section>

      {state.isUnlimited && !readOnly && !quitado && saldoEfetivo > 0 && (
        // Recomendações são exclusivas do plano Ilimitado; na leitura
        // congelada o ExclusiveCard acima ocupa o lugar das ações e destes
        // painéis, que não são montados para quem não é Ilimitado. Sem saldo
        // efetivo no modelo não há aporte a simular (painéis não fazem sentido).
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Recomendações</h2>
          <div
            key={`${saldoEfetivo}:${primeiraPendente}:${quitaEm}`}
            className="flex flex-col gap-6"
          >
            <EsePanel params={state.params} projecao={state.projecao} />
            <InvestPanel params={state.params} projecao={state.projecao} selicAnnual={selicAnnual} />
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Valores projetados são estimativas do modelo (TR e seguro constantes). O saldo real do banco vale quando você
        recalibra.
      </p>

      <RecalibrateDialog
        open={recalibrando}
        onOpenChange={setRecalibrando}
        saldoEfetivo={saldoEfetivo}
        primeiraPendente={primeiraPendente}
        diaVencimento={diaVencimento}
      />
      <EditContractDialog
        open={editandoContrato}
        onOpenChange={setEditandoContrato}
        params={params}
        saldoEfetivo={saldoEfetivo}
        primeiraPendente={primeiraPendente}
        diaVencimento={diaVencimento}
        stateVersion={baseline.version}
      />
      <PayInstallmentDialog
        open={pay !== null}
        onOpenChange={(v) => {
          if (!v) setPay(null);
        }}
        parcelaNumero={pay?.parcelaNumero ?? primeiraPendente}
        defaultValor={pay?.defaultValor ?? 0}
        dataVencimento={pay?.vencimento ?? hoje}
        initialAporte={pay?.aporte}
        estado={{ params, baseline, pagas, extras, projecao }}
        onDone={() => {
          if (pay) setUltimaPaga({ numero: pay.parcelaNumero });
        }}
      />
      <ConfirmDialog
        open={desfazerAlvo !== null}
        onOpenChange={(v) => {
          if (!v) setDesfazerAlvo(null);
        }}
        title="Desfazer pagamento?"
        description={desfazerAlvo ? `Parcela ${desfazerAlvo.numero} · ${formatBRL(desfazerAlvo.valor)}` : ''}
        confirmLabel="Desfazer"
        pendingLabel="Desfazendo..."
        onConfirm={() => desfazer(desfazerAlvo!)}
      />
    </div>
  );
}
