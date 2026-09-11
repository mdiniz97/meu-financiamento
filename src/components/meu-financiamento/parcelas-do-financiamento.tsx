'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { editMovement, deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { AmortizacaoComId, PageState, ParcelaPagaComId } from '@/lib/meu-financiamento/repo';
import {
  buildCronograma,
  distribuirAportes,
  type CronogramaParcela,
} from '@/lib/meu-financiamento/cronograma';
import { formatDataBr } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PayInstallment } from './pay-installment';
import { ConfirmDialog } from './confirm-dialog';
import { ModoRadios, OrigemRadios } from './amortization-form';

const HEAD_BASE = 'sticky top-0 z-10 bg-card h-10 px-2 align-middle font-medium whitespace-nowrap text-foreground';
const COLUNAS = 11;

type Editor =
  | { tipo: 'pagar'; numero: number }
  | { tipo: 'editar'; numero: number }
  | { tipo: 'editar-amortizacao'; numero: number; amortizacaoId: string };

type ApagarAlvo =
  | { tipo: 'parcela'; id: string; numero: number; valor: number }
  | { tipo: 'amortizacao'; id: string; numero: number; valor: number };

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Célula numérica da composição: "—" quando o encadeamento não reconstruiu a
 *  paga (período anterior), senão o valor projetado/real em BRL. */
function celulaValor(valor: number | undefined): string {
  return valor == null ? '—' : formatBRL(valor);
}

/** O saldo por competência das pagas é o do encadeamento SEM extras; quando
 *  existe amortização extra do estado vigente até a data da paga ele deixa de
 *  representar o saldo real e vira "—", para não conflitar com o saldo efetivo
 *  do estado. Nas parcelas em aberto o saldo é sempre exibido. */
function saldoParcela(linha: CronogramaParcela, extraAplicavel: (data: string) => boolean): string {
  if (!linha.composicao) return '—';
  if (linha.situacao !== 'aberta' && extraAplicavel(linha.paga?.dataPagamento ?? '')) return '—';
  return formatBRL(linha.composicao.saldo);
}

const STICKY_BG: Record<CronogramaParcela['situacao'], string> = {
  paga: 'bg-emerald-50 dark:bg-emerald-950',
  historico: 'bg-muted',
  aberta: 'bg-card',
};

const ROW_BG: Record<CronogramaParcela['situacao'], string> = {
  paga: 'bg-emerald-50/40 dark:bg-emerald-950/20',
  historico: 'bg-muted/30',
  aberta: '',
};

function Situacao({ linha }: { linha: CronogramaParcela }) {
  if (linha.situacao === 'aberta') {
    return <span className="text-muted-foreground">Em aberto</span>;
  }
  if (linha.situacao === 'paga') {
    return (
      <span className="inline-flex flex-col text-emerald-700 dark:text-emerald-400">
        <span className="inline-flex items-center gap-1 font-medium">
          <Check className="size-3" />
          Paga
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {formatDataBr(linha.paga?.dataPagamento ?? '')}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col text-muted-foreground">
      <span className="font-medium">Histórico</span>
      <span className="text-xs">{formatDataBr(linha.paga?.dataPagamento ?? '')}</span>
    </span>
  );
}

/** Editor inline de uma parcela paga do estado vigente (valor + data). Reusa a
 *  action `editMovement`; o editor permanece aberto após Salvar (fecha no
 *  Cancelar) e o erro sai no `role="alert"` local. */
function EditarParcela({ paga, onClose }: { paga: ParcelaPagaComId; onClose: () => void }) {
  const router = useRouter();
  const [valor, setValor] = useState(roundCents(paga.valor));
  const [dataPagamento, setDataPagamento] = useState(paga.dataPagamento);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy(true);
    setError('');
    let result;
    try {
      result = await editMovement(paga.id, { valor, dataPagamento });
    } catch {
      setBusy(false);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await router.refresh();
    setBusy(false);
  }

  return (
    <TableRow data-row-editor="parcela" className="bg-muted/20">
      <TableCell colSpan={COLUNAS} className="whitespace-normal align-top">
        <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-56 flex-col gap-1.5">
              <label htmlFor={`editarValor-${paga.id}`} className="text-sm font-medium text-foreground">
                Valor pago (R$)
              </label>
              <MoneyInput
                id={`editarValor-${paga.id}`}
                value={valor}
                onValid={setValor}
                disabled={busy}
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
                disabled={busy}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void salvar()}
                disabled={busy || valor <= 0 || !dataPagamento}
              >
                {busy ? 'Salvando...' : 'Salvar'}
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
  );
}

/** Editor inline de uma amortização extra do estado vigente (valor, data,
 *  origem e modo). Reusa a action `editMovement`; permanece aberto após Salvar e
 *  o erro sai no `role="alert"` local. */
function EditarAmortizacao({
  amortizacao,
  onClose,
}: {
  amortizacao: AmortizacaoComId;
  onClose: () => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(roundCents(amortizacao.valor));
  const [dataPagamento, setDataPagamento] = useState(amortizacao.dataPagamento);
  const [origem, setOrigem] = useState<'proprio' | 'fgts'>(amortizacao.origem);
  const [modo, setModo] = useState<'term' | 'payment'>(amortizacao.modo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy(true);
    setError('');
    let result;
    try {
      result = await editMovement(amortizacao.id, { valor, dataPagamento, origem, modo });
    } catch {
      setBusy(false);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await router.refresh();
    setBusy(false);
  }

  return (
    <TableRow data-row-editor="amortizacao" className="bg-muted/20">
      <TableCell colSpan={COLUNAS} className="whitespace-normal align-top">
        <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex w-56 flex-col gap-1.5">
              <label htmlFor={`editarAmortValor-${amortizacao.id}`} className="text-sm font-medium text-foreground">
                Valor amortizado (R$)
              </label>
              <MoneyInput
                id={`editarAmortValor-${amortizacao.id}`}
                value={valor}
                onValid={setValor}
                disabled={busy}
              />
            </div>
            <div className="flex w-48 flex-col gap-1.5">
              <label htmlFor={`editarAmortData-${amortizacao.id}`} className="text-sm font-medium text-foreground">
                Data do pagamento
              </label>
              <Input
                id={`editarAmortData-${amortizacao.id}`}
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Origem</span>
              <OrigemRadios value={origem} onChange={setOrigem} disabled={busy} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">O que o banco fez</span>
              <ModoRadios value={modo} onChange={setModo} disabled={busy} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void salvar()}
                disabled={busy || valor <= 0 || !dataPagamento}
              >
                {busy ? 'Salvando...' : 'Salvar'}
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
  );
}

/**
 * Tabela "Parcelas do Financiamento": cronograma completo a partir do estado
 * vigente (projetadas + pagas do histórico) no padrão da tabela do simulador
 * (scroll interno, header sticky e primeira coluna sticky). Sem accordion e sem
 * paginação: TODAS as competências ficam no DOM dentro do scroll `h-[480px]`.
 *
 * Ações por linha (ausentes em readOnly e no contrato quitado):
 * - primeira parcela pendente: botão "Pagar" abre inline o `PayInstallment` do
 *   card do mês (com "Definir hoje" e o eventual split de amortização);
 * - pagas do estado vigente: Editar (editor inline) e Apagar (`ConfirmDialog`).
 *   O Editar some quando a parcela tem amortização vinculada (groupId), recusada
 *   pela action; o Apagar só aparece na ÚLTIMA paga, única removível sem criar
 *   lacuna. O vínculo com o estado é feito por `state.pagas` (não pelo histórico);
 * - amortizações extras do estado vigente: Editar/Apagar na coluna "Aporte" da
 *   linha onde o aporte aparece, com os guards do servidor respeitados;
 * - pagas de períodos anteriores: selo "Histórico", sem ações (o servidor já
 *   recusa editar/apagar estado superado).
 *
 * As amortizações extras entram na coluna "Aporte" da linha da última paga
 * anterior (ou da primeira em aberto, sem paga); as de baselines superados já
 * estão absorvidas pelo saldo vigente e não geram linha.
 */
export function ParcelasDoFinanciamento({
  state,
  readOnly = false,
  quitado = false,
}: {
  state: Pick<PageState, 'params' | 'baseline' | 'pagas' | 'extras' | 'projecao' | 'historico'>;
  readOnly?: boolean;
  quitado?: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [apagarAlvo, setApagarAlvo] = useState<ApagarAlvo | null>(null);

  const linhas = buildCronograma(state.baseline, state.projecao, state.historico, state.extras);
  const temExtraAplicavel = (data: string) => state.extras.some((e) => e.dataPagamento <= data);
  // Vínculo de ação só com o estado VIGENTE: o histórico serve para exibir os
  // selos das pagas de períodos anteriores, nunca para mirar movements editáveis.
  const pagaPorNumero = new Map(state.pagas.map((p) => [p.parcelaNumero, p]));
  const ultimaPaga = state.pagas.reduce((maior, p) => Math.max(maior, p.parcelaNumero), 0);
  const aportesPorLinha = distribuirAportes(linhas, state.extras);
  const primeiraAberta = linhas.find((l) => l.situacao === 'aberta') ?? null;
  const podeAgir = !readOnly && !quitado;

  async function apagar() {
    const result = await deleteMovement(apagarAlvo!.id);
    if (result.ok) await router.refresh();
    return result;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">Parcelas do Financiamento</h2>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma parcela para exibir.</p>
      ) : (
        <div className="h-[480px] overflow-auto rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
          <table className="w-full caption-bottom border-separate border-spacing-0 font-mono tabular-nums text-sm">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className={`${HEAD_BASE} sticky left-0 z-20 border-r border-border`}>
                  Nº
                </TableHead>
                <TableHead scope="col" className={HEAD_BASE}>Vencimento</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Parcela</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Aporte</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Total</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Juros</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Amortização</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Seguro</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Correção</TableHead>
                <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Saldo</TableHead>
                <TableHead scope="col" className={HEAD_BASE}>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => {
                const pagaMov = pagaPorNumero.get(linha.numero);
                const ehPrimeiraAberta = primeiraAberta?.numero === linha.numero;
                const extrasDaLinha = aportesPorLinha.get(linha.numero) ?? [];
                const extraEmEdicao =
                  editor?.tipo === 'editar-amortizacao' && editor.numero === linha.numero
                    ? extrasDaLinha.find((e) => e.id === editor.amortizacaoId)
                    : undefined;
                return (
                  <Fragment key={`parcela-${linha.numero}`}>
                    <TableRow
                      data-row="parcela"
                      data-numero={linha.numero}
                      data-situacao={linha.situacao}
                      className={ROW_BG[linha.situacao]}
                    >
                      <TableCell
                        className={`sticky left-0 z-10 border-r border-border font-medium ${STICKY_BG[linha.situacao]}`}
                      >
                        {linha.numero}
                      </TableCell>
                      <TableCell>{formatDataBr(linha.vencimento)}</TableCell>
                      <TableCell data-cell="parcela" className="text-right">{formatBRL(linha.valor)}</TableCell>
                      <TableCell data-cell="aporte" className="text-right">
                        {linha.aporte > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-medium text-primary">{formatBRL(linha.aporte)}</span>
                            {podeAgir && extrasDaLinha.length > 0 && (
                              <span className="flex shrink-0 items-center gap-0.5">
                                {extrasDaLinha.map((extra, index) => {
                                  // Com mais de uma extra na mesma linha o rótulo
                                  // repetido colidiria no E2E/leitor de tela;
                                  // a posição e o valor desambiguam.
                                  const sufixo =
                                    extrasDaLinha.length > 1
                                      ? ` ${index + 1} (${formatBRL(extra.valor)})`
                                      : '';
                                  return (
                                    <Fragment key={extra.id}>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          setEditor({ tipo: 'editar-amortizacao', numero: linha.numero, amortizacaoId: extra.id })
                                        }
                                        aria-label={`Editar amortização${sufixo}`}
                                        className="size-8 text-muted-foreground hover:text-foreground"
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          setApagarAlvo({
                                            tipo: 'amortizacao',
                                            id: extra.id,
                                            numero: linha.numero,
                                            valor: extra.valor,
                                          })
                                        }
                                        aria-label={`Apagar amortização${sufixo}`}
                                        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </Fragment>
                                  );
                                })}
                              </span>
                            )}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell data-cell="total" className="text-right font-semibold">
                        {formatBRL(linha.valor + linha.aporte)}
                      </TableCell>
                      <TableCell className="text-right">{celulaValor(linha.composicao?.juros)}</TableCell>
                      <TableCell className="text-right">{celulaValor(linha.composicao?.amortizacao)}</TableCell>
                      <TableCell className="text-right">{celulaValor(linha.composicao?.seguro)}</TableCell>
                      <TableCell className="text-right">{celulaValor(linha.composicao?.correcao)}</TableCell>
                      <TableCell data-cell="saldo" className="text-right">
                        {saldoParcela(linha, temExtraAplicavel)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <Situacao linha={linha} />
                          {podeAgir && linha.situacao === 'aberta' && ehPrimeiraAberta && (
                            <Button
                              type="button"
                              onClick={() => setEditor({ tipo: 'pagar', numero: linha.numero })}
                            >
                              Pagar
                            </Button>
                          )}
                          {podeAgir && linha.situacao === 'paga' && pagaMov && (
                            <div className="flex shrink-0 items-center gap-1">
                              {!pagaMov.groupId && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditor({ tipo: 'editar', numero: linha.numero })}
                                  aria-label={`Editar parcela ${linha.numero}`}
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              )}
                              {linha.numero === ultimaPaga && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setApagarAlvo({
                                      tipo: 'parcela',
                                      id: pagaMov.id,
                                      numero: linha.numero,
                                      valor: pagaMov.valor,
                                    })
                                  }
                                  aria-label={`Apagar parcela ${linha.numero}`}
                                  className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {editor?.numero === linha.numero && editor.tipo === 'editar' && pagaMov && (
                      <EditarParcela paga={pagaMov} onClose={() => setEditor(null)} />
                    )}
                    {editor?.numero === linha.numero && editor.tipo === 'editar-amortizacao' && extraEmEdicao && (
                      <EditarAmortizacao
                        key={extraEmEdicao.id}
                        amortizacao={extraEmEdicao}
                        onClose={() => setEditor(null)}
                      />
                    )}
                    {editor?.numero === linha.numero && editor.tipo === 'pagar' && (
                      <TableRow data-row-editor="pagar" className="bg-muted/20">
                        <TableCell colSpan={COLUNAS} className="whitespace-normal align-top">
                          <PayInstallment
                            key={`pagar-${linha.numero}`}
                            parcelaNumero={linha.numero}
                            defaultValor={linha.valor}
                            dataVencimento={linha.vencimento}
                            estado={{
                              params: state.params,
                              baseline: state.baseline,
                              pagas: state.pagas,
                              extras: state.extras,
                              projecao: state.projecao,
                            }}
                            onCancel={() => setEditor(null)}
                            onDone={() => setEditor(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={apagarAlvo !== null}
        onOpenChange={(v) => {
          if (!v) setApagarAlvo(null);
        }}
        title="Apagar lançamento?"
        description={
          apagarAlvo
            ? apagarAlvo.tipo === 'parcela'
              ? `Parcela ${apagarAlvo.numero} · ${formatBRL(apagarAlvo.valor)}`
              : `Amortização extra de ${formatBRL(apagarAlvo.valor)}`
            : ''
        }
        confirmLabel="Apagar"
        pendingLabel="Apagando..."
        onConfirm={apagar}
      />
    </section>
  );
}
