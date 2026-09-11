'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { editPayment, deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { AmortizacaoComId, PageState, ParcelaPagaComId } from '@/lib/meu-financiamento/repo';
import {
  buildCronograma,
  type CronogramaParcela,
} from '@/lib/meu-financiamento/cronograma';
import { formatDataBr } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PayInstallmentDialog, ModoRadios } from './pay-installment';
import { ConfirmDialog } from './confirm-dialog';

const HEAD_BASE = 'sticky top-0 z-10 bg-card h-10 px-2 align-middle font-medium whitespace-nowrap text-foreground';

type ApagarAlvo = { tipo: 'parcela'; id: string; numero: number; valor: number };

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

/** Dialog de edição de um pagamento do estado vigente: valor/data e, quando o
 *  lançamento tem aporte vinculado (groupId), o valor e o modo da amortização,
 *  salvos juntos na mesma transação (`editPayment`). O conteúdo só monta com o
 *  dialog aberto e o erro sai no `role="alert"` local. */
function EditarPagamentoDialog({
  paga,
  aporte,
  onOpenChange,
}: {
  paga: ParcelaPagaComId | null;
  aporte: AmortizacaoComId | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={paga !== null}
      onOpenChange={(v) => {
        if (v || !pending) onOpenChange(v);
      }}
    >
      {paga && (
        <EditarPagamentoContent
          key={paga.id}
          paga={paga}
          aporte={aporte}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function EditarPagamentoContent({
  paga,
  aporte,
  pending,
  onPendingChange,
  onClose,
}: {
  paga: ParcelaPagaComId;
  aporte: AmortizacaoComId | null;
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(() => roundCents(paga.valor));
  const [dataPagamento, setDataPagamento] = useState(paga.dataPagamento);
  const [aporteValor, setAporteValor] = useState(() => (aporte ? roundCents(aporte.valor) : 0));
  const [modo, setModo] = useState<'term' | 'payment'>(aporte?.modo ?? 'term');
  const [error, setError] = useState('');
  const temAporte = aporte !== null;

  async function salvar() {
    if (pending || valor <= 0 || !dataPagamento) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      result = await editPayment(paga.id, {
        valor,
        dataPagamento,
        // Valor 0 remove o aporte e desfaz o vínculo; é a forma de zerar a
        // amortização pela edição do próprio pagamento.
        ...(temAporte ? { aporte: { valor: aporteValor, modo } } : {}),
      });
    } catch {
      onPendingChange(false);
      setError('Sessão expirada, entre novamente');
      return;
    }
    if ('error' in result) {
      onPendingChange(false);
      setError(result.error);
      return;
    }
    await router.refresh();
    onPendingChange(false);
    onClose();
  }

  return (
    <DialogContent className="sm:max-w-md" data-edit-pagamento>
      <DialogHeader>
        <DialogTitle>Editar pagamento da parcela {paga.parcelaNumero}</DialogTitle>
        <DialogDescription>
          Ajuste o valor pago, a data e, se houver, a amortização extra vinculada.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${paga.id}-valor`} className="text-sm font-medium text-foreground">
              Valor pago (R$)
            </label>
            <MoneyInput
              id={`${paga.id}-valor`}
              value={valor}
              onValid={setValor}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${paga.id}-data`} className="text-sm font-medium text-foreground">
              Data do pagamento
            </label>
            <Input
              id={`${paga.id}-data`}
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        {temAporte && (
          <div className="flex flex-col gap-3 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3">
            <p className="text-sm font-medium text-foreground">Amortização extra vinculada</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${paga.id}-aporte`} className="text-sm font-medium text-foreground">
                Amortização extra (R$)
              </label>
              <MoneyInput
                id={`${paga.id}-aporte`}
                value={aporteValor}
                onValid={setAporteValor}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Zerar o valor remove o aporte deste pagamento.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">O que o banco fez</span>
              <ModoRadios value={modo} onChange={setModo} disabled={pending} />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void salvar()}
          disabled={pending || valor <= 0 || !dataPagamento}
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Tabela "Parcelas do Financiamento": cronograma completo a partir do estado
 * vigente (projetadas + pagas do histórico) no padrão da tabela do simulador
 * (scroll interno, header sticky e primeira coluna sticky). Sem accordion e sem
 * paginação: TODAS as competências ficam no DOM dentro do scroll `h-[480px]`.
 *
 * Ações por linha (ausentes em readOnly e no contrato quitado):
 * - primeira parcela pendente: botão "Pagar" abre o `PayInstallmentDialog` do
 *   card do mês (com "Definir hoje" e a seção de amortização extra opcional);
 * - pagas do estado vigente: Editar (dialog de pagamento: valor, data e aporte
 *   vinculado) e Apagar (`ConfirmDialog`). O Apagar só aparece na ÚLTIMA paga,
 *   única removível sem criar lacuna e remove o grupo inteiro (parcela +
 *   aporte). O vínculo com o estado é feito por `state.pagas`;
 * - amortizações extras: moram na coluna "Aporte" como VALOR, sem ações
 *   próprias. A edição/exclusão acontece pelo pagamento vinculado (mesmo
 *   groupId). Amortizações legadas sem groupId não são editáveis nem apagáveis
 *   por aqui (ficam só exibidas, em linha própria quando não vinculadas);
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
  const [pagando, setPagando] = useState<{ numero: number; valor: number; vencimento: string } | null>(null);
  const [editandoPagamento, setEditandoPagamento] = useState<ParcelaPagaComId | null>(null);
  const [apagarAlvo, setApagarAlvo] = useState<ApagarAlvo | null>(null);

  const linhas = buildCronograma(state.baseline, state.projecao, state.historico, state.extras);
  const temExtraAplicavel = (data: string) => state.extras.some((e) => e.dataPagamento <= data);
  // Vínculo de ação só com o estado VIGENTE: o histórico serve para exibir os
  // selos das pagas de períodos anteriores, nunca para mirar movements editáveis.
  const pagaPorNumero = new Map(state.pagas.map((p) => [p.parcelaNumero, p]));
  const ultimaPaga = state.pagas.reduce((maior, p) => Math.max(maior, p.parcelaNumero), 0);
  const primeiraAberta = linhas.find((l) => l.situacao === 'aberta') ?? null;
  const podeAgir = !readOnly && !quitado;
  // Aporte vinculado do pagamento em edição: mesmo groupId.
  const aporteDoPagamento = editandoPagamento?.groupId
    ? state.extras.find((e) => e.groupId === editandoPagamento.groupId) ?? null
    : null;

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
                return (
                  <TableRow
                    key={`parcela-${linha.numero}`}
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
                        <span className="font-medium text-primary">{formatBRL(linha.aporte)}</span>
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
                            onClick={() =>
                              setPagando({
                                numero: linha.numero,
                                valor: linha.valor,
                                vencimento: linha.vencimento,
                              })
                            }
                          >
                            Pagar
                          </Button>
                        )}
                        {podeAgir && linha.situacao === 'paga' && pagaMov && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditandoPagamento(pagaMov)}
                              aria-label={`Editar parcela ${linha.numero}`}
                              className="size-8 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
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
                );
              })}
            </TableBody>
          </table>
        </div>
      )}
      <PayInstallmentDialog
        open={pagando !== null}
        onOpenChange={(v) => {
          if (!v) setPagando(null);
        }}
        parcelaNumero={pagando?.numero ?? primeiraAberta?.numero ?? 0}
        defaultValor={pagando?.valor ?? primeiraAberta?.valor ?? 0}
        dataVencimento={pagando?.vencimento ?? primeiraAberta?.vencimento ?? ''}
        estado={{
          params: state.params,
          baseline: state.baseline,
          pagas: state.pagas,
          extras: state.extras,
          projecao: state.projecao,
        }}
      />
      <EditarPagamentoDialog
        paga={editandoPagamento}
        aporte={aporteDoPagamento}
        onOpenChange={(v) => {
          if (!v) setEditandoPagamento(null);
        }}
      />
      <ConfirmDialog
        open={apagarAlvo !== null}
        onOpenChange={(v) => {
          if (!v) setApagarAlvo(null);
        }}
        title="Apagar lançamento?"
        description={
          apagarAlvo ? `Parcela ${apagarAlvo.numero} · ${formatBRL(apagarAlvo.valor)}` : ''
        }
        confirmLabel="Apagar"
        pendingLabel="Apagando..."
        onConfirm={apagar}
      />
    </section>
  );
}
