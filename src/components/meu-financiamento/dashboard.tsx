'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePen, Landmark, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { ExclusiveCard } from '@/components/exclusive-card';
import { deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { PageState, ParcelaPagaComId } from '@/lib/meu-financiamento/repo';
import { addMonthsISO, formatDataBr, formatMesAno, todayISO } from '@/lib/meu-financiamento/dates';
import { economiaAmortizacoes } from '@/lib/finance/meu-financiamento/economia';
import { formatBRL } from '@/lib/utils';
import { PayInstallment } from './pay-installment';
import { AmortizacaoDialog } from './amortization-form';
import { RecalibrateDialog } from './recalibrate-dialog';
import { EditContractDialog } from './edit-contract-dialog';
import { Timeline } from './timeline';
import { TodasParcelas } from './todas-parcelas';
import { SugestaoAmortizacao } from './sugestao-amortizacao';
import { EsePanel } from './e-se-panel';
import { InvestPanel } from './invest-panel';

const DIVERGENCIA_BANNER_LIMITE = 200;

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
  const [showPay, setShowPay] = useState(false);
  const [aporteSugerido, setAporteSugerido] = useState<number | null>(null);
  const [recalibrando, setRecalibrando] = useState(false);
  const [editandoContrato, setEditandoContrato] = useState(false);
  const [amortizando, setAmortizando] = useState(false);
  const [ultimaPaga, setUltimaPaga] = useState<{ numero: number } | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const [desfazerError, setDesfazerError] = useState('');

  const quitado = state.quitado;
  const hoje = todayISO();

  const vencimentoEstimado = (parcelaNumero: number) =>
    addMonthsISO(baseline.dataBase, parcelaNumero - baseline.proximaParcelaNumero);

  const quitaEmData = quitaEm != null
    ? addMonthsISO(baseline.dataBase, quitaEm - baseline.proximaParcelaNumero)
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

  // Economia usa o estado VIGENTE (extras atuais), nunca o histórico: as
  // amortizações de baselines superados já estão incorporadas no saldo do
  // baseline novo e reaplicá-las duplicaria a economia.
  const economia = economiaAmortizacoes(params, baseline, pagas, extras);
  const economiaPositiva = Math.round(economia * 100) > 0;

  // Confirmação só vale enquanto a parcela recém-paga existir no estado atual
  // (apagar pela timeline ou recalibrar some com a linha e com o Desfazer).
  const pagaConfirmada = ultimaPaga
    ? (pagas.find((p) => p.parcelaNumero === ultimaPaga.numero) ?? null)
    : null;

  async function desfazer(paga: ParcelaPagaComId) {
    if (desfazendo) return;
    const confirma = window.confirm(
      `Desfazer o pagamento da parcela ${paga.parcelaNumero}? Essa ação não pode ser desfeita.`,
    );
    if (!confirma) return;
    setDesfazendo(true);
    setDesfazerError('');
    let result;
    try {
      result = await deleteMovement(paga.id);
    } catch {
      setDesfazendo(false);
      setDesfazerError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      setDesfazendo(false);
      setDesfazerError(result.error);
      return;
    }
    await router.refresh();
    setUltimaPaga(null);
    setDesfazendo(false);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Landmark className="size-3.5 text-[#820AD1]" />
          {params.bank} · {params.system} · Parcela {primeiraPendente} de {params.parcelasTotais}
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-[#820AD1]/20 bg-primary/[0.04] p-6">
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
            <p className="text-xs font-medium text-muted-foreground">Total pago</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{formatBRL(totalPago)}</p>
            <p className="text-xs text-muted-foreground">Parcelas e amortizações extras registradas</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Economizado com amortizações</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {economiaPositiva ? formatBRL(economia) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {economiaPositiva
                ? 'juros, correção e seguro evitados no modelo'
                : 'registre uma amortização para ver a economia'}
            </p>
          </div>
        </div>
      </section>

      {!readOnly && !quitado && (
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            aria-label="Registrar amortização extra"
            aria-describedby="acao-amortizar-desc"
            onClick={() => setAmortizando(true)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[#820AD1]/50 hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="rounded-xl bg-[#820AD1]/10 p-2 text-[#820AD1]">
              <PiggyBank className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">Registrar amortização extra</span>
              <span id="acao-amortizar-desc" className="text-xs text-muted-foreground">
                Aporte separado do boleto, com FGTS ou dinheiro próprio.
              </span>
            </span>
          </button>
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
            <Button type="button" size="sm" onClick={() => setRecalibrando(true)}>
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
            <Button type="button" size="sm" onClick={() => setRecalibrando(true)}>
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
              <Button type="button" size="sm" onClick={() => setRecalibrando(true)}>
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
                size="sm"
                onClick={() => void desfazer(pagaConfirmada)}
                disabled={desfazendo}
              >
                {desfazendo ? 'Desfazendo...' : 'Desfazer'}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold">
              {vencida ? 'Parcela em aberto' : 'Sua parcela deste mês'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Parcela {primeiraPendente} de {params.parcelasTotais}
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
                {formatBRL(primeiraProjetada.parcela)}
              </p>
              <p className="text-xs text-muted-foreground">
                Vencimento estimado: {vencimentoPrimeira ? formatDataBr(vencimentoPrimeira) : '—'}
                {vencida ? ' (vencida)' : ''}
              </p>
            </div>
            {!readOnly && !showPay && (
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  // Nunca coexistir com o alerta do Desfazer no mesmo card.
                  setDesfazerError('');
                  setAporteSugerido(null);
                  setShowPay(true);
                }}
              >
                Paguei esta parcela
              </Button>
            )}
          </div>
          {!readOnly && (
            <SugestaoAmortizacao
              params={params}
              baseline={baseline}
              pagas={pagas}
              extras={extras}
              projecao={projecao}
              onAplicar={(aporte) => {
                setDesfazerError('');
                setAporteSugerido(aporte);
                setShowPay(true);
              }}
            />
          )}
          {!readOnly && showPay && (
            <PayInstallment
              key={aporteSugerido ?? 'sem-aporte'}
              parcelaNumero={primeiraProjetada.parcelaNumero}
              defaultValor={primeiraProjetada.parcela}
              initialAporte={aporteSugerido ?? undefined}
              onCancel={() => {
                setAporteSugerido(null);
                setShowPay(false);
              }}
              onDone={() => {
                setUltimaPaga({ numero: primeiraProjetada.parcelaNumero });
                setAporteSugerido(null);
                setShowPay(false);
              }}
            />
          )}
          {desfazerError && (
            <p role="alert" className="text-sm text-destructive">
              {desfazerError}
            </p>
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

      <Timeline state={state} readOnly={readOnly} quitado={quitado} />

      <TodasParcelas state={state} />

      {parcelas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Projeção do saldo</h2>
          <BalanceChart data={parcelas.map((p) => ({ month: p.parcelaNumero, saldo: p.saldo }))} />
        </section>
      )}

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
      />
      <EditContractDialog
        open={editandoContrato}
        onOpenChange={setEditandoContrato}
        params={params}
        saldoEfetivo={saldoEfetivo}
        primeiraPendente={primeiraPendente}
      />
      <AmortizacaoDialog open={amortizando} onOpenChange={setAmortizando} />
    </div>
  );
}
