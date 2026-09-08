'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { editMovement, deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { PageState, ParcelaPagaComId } from '@/lib/meu-financiamento/repo';
import { addMonthsISO, formatDataBr, formatMesAno } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';
import { PayInstallment } from './pay-installment';
import { AmortizacoesSection } from './amortization-form';
import { RecalibrateDialog } from './recalibrate-dialog';
import { EsePanel } from './e-se-panel';
import { InvestPanel } from './invest-panel';

const DIVERGENCIA_BANNER_LIMITE = 200;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
    </div>
  );
}

function PagaRow({ paga, readOnly }: { paga: ParcelaPagaComId; readOnly: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(roundCents(paga.valor));
  const [dataPagamento, setDataPagamento] = useState(paga.dataPagamento);
  const [busy, setBusy] = useState<'edit' | 'delete' | null>(null);
  const [error, setError] = useState('');

  function abrirEdicao() {
    setValor(roundCents(paga.valor));
    setDataPagamento(paga.dataPagamento);
    setError('');
    setEditando(true);
  }

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy('edit');
    setError('');
    let result;
    try {
      result = await editMovement(paga.id, { valor, dataPagamento });
    } catch {
      setBusy(null);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      setBusy(null);
      setError(result.error);
      return;
    }
    await router.refresh();
    setBusy(null);
  }

  async function apagar() {
    if (busy) return;
    // Confirmar é barreira explícita: a action ainda valida a regra de lacuna
    // e o erro dela é exibido caso o apagamento crie uma.
    const confirma = window.confirm(
      `Apagar o lançamento da parcela ${paga.parcelaNumero}? Essa ação não pode ser desfeita.`,
    );
    if (!confirma) return;
    setBusy('delete');
    setError('');
    let result;
    try {
      result = await deleteMovement(paga.id);
    } catch {
      setBusy(null);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      setBusy(null);
      setError(result.error);
      return;
    }
    await router.refresh();
    setBusy(null);
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-mono tabular-nums">{paga.parcelaNumero}</TableCell>
        <TableCell className="font-mono tabular-nums">{formatBRL(paga.valor)}</TableCell>
        <TableCell>{formatDataBr(paga.dataPagamento)}</TableCell>
        {!readOnly && (
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={abrirEdicao} disabled={busy !== null}>
                <Pencil className="size-3.5" />
                Editar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void apagar()}
                disabled={busy !== null}
              >
                <Trash2 className="size-3.5" />
                {busy === 'delete' ? 'Apagando...' : 'Apagar'}
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
      {editando && !readOnly && (
        <TableRow>
          <TableCell colSpan={readOnly ? 3 : 4} className="bg-muted/30 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex w-56 flex-col gap-1.5">
                  <label htmlFor={`editarValor-${paga.id}`} className="text-sm font-medium text-foreground">
                    Valor pago (R$)
                  </label>
                  <MoneyInput
                    id={`editarValor-${paga.id}`}
                    value={valor}
                    onValid={setValor}
                    disabled={busy !== null}
                  />
                </div>
                <div className="flex w-48 flex-col gap-1.5">
                  <label htmlFor={`editarData-${paga.id}`} className="text-sm font-medium text-foreground">
                    Data do pagamento
                  </label>
                  <Input
                    id={`editarData-${paga.id}`}
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    disabled={busy !== null}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)} disabled={busy !== null}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={() => void salvar()} disabled={busy !== null || valor <= 0 || !dataPagamento}>
                    {busy === 'edit' ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {!editando && error && (
        <TableRow>
          <TableCell colSpan={4} className="p-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function Dashboard({
  state,
  readOnly = false,
  selicAnnual = null,
}: {
  state: PageState;
  /** Modo somente leitura (sem ações); a Task 8 liga a página a este estado. */
  readOnly?: boolean;
  /** Selic anual do BACEN para o painel investir ou amortizar; null usa o padrão. */
  selicAnnual?: number | null;
}) {
  const { params, baseline, pagas, extras, projecao } = state;
  const { parcelas, quitaEm, divergencia, saldoEfetivo, primeiraPendente } = projecao;
  const parcelasBoletos = parcelas.slice(0, 12);
  const primeiraProjetada = parcelas[0] ?? null;
  const [showPay, setShowPay] = useState(false);
  const [recalibrando, setRecalibrando] = useState(false);

  const quitado = saldoEfetivo === 0;

  const vencimentoEstimado = (parcelaNumero: number) =>
    addMonthsISO(baseline.dataBase, parcelaNumero - baseline.proximaParcelaNumero);

  const quitaEmData = quitaEm != null
    ? addMonthsISO(baseline.dataBase, quitaEm - baseline.proximaParcelaNumero)
    : null;

  const haBoletos = parcelasBoletos.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Resumo</h2>
        {quitado ? (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            <p>Financiamento quitado</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Saldo zerado. O registro do contrato é mantido e os lançamentos anteriores à última recalibração ficam
              como histórico no banco.
            </p>
          </div>
        ) : (
          Math.abs(divergencia) >= DIVERGENCIA_BANNER_LIMITE && (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Saldo devedor atual" value={formatBRL(saldoEfetivo)} />
          <SummaryCard
            label="Próxima parcela"
            value={primeiraProjetada ? formatBRL(primeiraProjetada.parcela) : '—'}
            caption={primeiraProjetada ? `Parcela ${primeiraPendente} de ${params.parcelasTotais}` : undefined}
          />
          <SummaryCard
            label="Quitação estimada"
            value={quitaEm != null && quitaEmData ? `Parcela ${quitaEm} (${formatMesAno(quitaEmData)})` : (quitado ? '—' : 'não no prazo')}
          />
        </div>
        {parcelas.length > 0 && <BalanceChart data={parcelas.map((p) => ({ month: p.parcelaNumero, saldo: p.saldo }))} />}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Próximos boletos</h2>
          {!readOnly && haBoletos && !showPay && (
            <Button type="button" onClick={() => setShowPay(true)}>
              Paguei
            </Button>
          )}
        </div>
        {haBoletos && !readOnly && showPay && primeiraProjetada && (
          <PayInstallment
            parcelaNumero={primeiraProjetada.parcelaNumero}
            defaultValor={primeiraProjetada.parcela}
            onCancel={() => setShowPay(false)}
            onDone={() => setShowPay(false)}
          />
        )}
        {haBoletos ? (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela nº</TableHead>
                  <TableHead>Vencimento estimado</TableHead>
                  <TableHead className="text-right">Valor projetado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasBoletos.map((p) => (
                  <TableRow key={p.parcelaNumero}>
                    <TableCell className="font-mono tabular-nums">{p.parcelaNumero}</TableCell>
                    <TableCell>{formatDataBr(vencimentoEstimado(p.parcelaNumero))}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatBRL(p.parcela)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatBRL(p.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {quitado
              ? 'Contrato quitado: não há boletos em aberto. Confira o histórico abaixo.'
              : 'Não há parcelas em aberto neste contrato. Recalibre o contrato para registrar o saldo real do banco.'}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Parcelas pagas</h2>
        {pagas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma parcela paga ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela nº</TableHead>
                  <TableHead className="text-right">Valor pago</TableHead>
                  <TableHead>Data do pagamento</TableHead>
                  {!readOnly && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagas.map((p) => (
                  <PagaRow key={p.id} paga={p} readOnly={readOnly} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AmortizacoesSection extras={extras} readOnly={readOnly} quitado={quitado} />

      {state.isUnlimited && !readOnly && !quitado && (
        // Recomendações são exclusivas do plano Ilimitado e sem persistência;
        // a Task 8 substitui o corte por um ExclusiveCard quando aplicável.
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Recomendações</h2>
          <div
            key={`${saldoEfetivo}:${primeiraPendente}:${quitaEm}`}
            className="grid items-start gap-4 lg:grid-cols-2"
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
    </div>
  );
}
