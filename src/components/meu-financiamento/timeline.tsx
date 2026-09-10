'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FilePen, Landmark, Pencil, RefreshCw, Trash2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { editMovement, deleteMovement } from '@/app/(app)/meu-financiamento/actions';
import type { PageState } from '@/lib/meu-financiamento/repo';
import { buildTimelineGroups } from '@/lib/meu-financiamento/timeline';
import type { TimelineEvent } from '@/lib/meu-financiamento/timeline';
import { formatDataBr } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';
import { OrigemRadios, ModoRadios } from './amortization-form';

const LIMITE_EVENTOS = 12;

type ParcelaEvent = Extract<TimelineEvent, { kind: 'parcela' }>;
type AmortizacaoEvent = Extract<TimelineEvent, { kind: 'amortizacao' }>;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function TimelineIcon({ kind }: { kind: TimelineEvent['kind'] }) {
  const wrapper = 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full';
  switch (kind) {
    case 'parcela':
      return (
        <span className={`${wrapper} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300`}>
          <Check className="size-4" />
        </span>
      );
    case 'amortizacao':
      return (
        <span className={`${wrapper} bg-[#820AD1]/10 text-[#820AD1]`}>
          <TrendingDown className="size-4" />
        </span>
      );
    case 'recalibracao':
      return (
        <span className={`${wrapper} bg-muted text-muted-foreground`}>
          <RefreshCw className="size-4" />
        </span>
      );
    case 'quitacao':
      return (
        <span className={`${wrapper} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300`}>
          <Check className="size-4" />
        </span>
      );
    case 'atualizacao':
      return (
        <span className={`${wrapper} bg-muted text-muted-foreground`}>
          <FilePen className="size-4" />
        </span>
      );
    case 'cadastro':
      return (
        <span className={`${wrapper} bg-muted text-muted-foreground`}>
          <Landmark className="size-4" />
        </span>
      );
  }
}

function ParcelaItem({ event, podeAgir }: { event: ParcelaEvent; podeAgir: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(roundCents(event.valor));
  const [dataPagamento, setDataPagamento] = useState(event.data);
  const [busy, setBusy] = useState<'edit' | 'delete' | null>(null);
  const [error, setError] = useState('');

  function abrirEdicao() {
    setValor(roundCents(event.valor));
    setDataPagamento(event.data);
    setError('');
    setEditando(true);
  }

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy('edit');
    setError('');
    let result;
    try {
      result = await editMovement(event.id, { valor, dataPagamento });
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
      `Apagar o lançamento da parcela ${event.numero}? Essa ação não pode ser desfeita.`,
    );
    if (!confirma) return;
    setBusy('delete');
    setError('');
    let result;
    try {
      result = await deleteMovement(event.id);
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
    <li className="flex gap-3 border-b border-border/60 py-3 last:border-b-0">
      <TimelineIcon kind="parcela" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm">{event.text}</p>
          {podeAgir && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={abrirEdicao}
                disabled={busy !== null}
                aria-label={`Editar parcela ${event.numero}`}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void apagar()}
                disabled={busy !== null}
                aria-label={`Apagar parcela ${event.numero}`}
              >
                <Trash2 className="size-3.5" />
                {busy === 'delete' ? 'Apagando...' : 'Apagar'}
              </Button>
            </div>
          )}
        </div>
        {editando && podeAgir && (
          <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-56 flex-col gap-1.5">
                <label htmlFor={`editarValor-${event.id}`} className="text-sm font-medium text-foreground">
                  Valor pago (R$)
                </label>
                <MoneyInput
                  id={`editarValor-${event.id}`}
                  value={valor}
                  onValid={setValor}
                  disabled={busy !== null}
                />
              </div>
              <div className="flex w-48 flex-col gap-1.5">
                <label htmlFor={`editarData-${event.id}`} className="text-sm font-medium text-foreground">
                  Data do pagamento
                </label>
                <Input
                  id={`editarData-${event.id}`}
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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void salvar()}
                  disabled={busy !== null || valor <= 0 || !dataPagamento}
                >
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
        )}
        {!editando && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function AmortizacaoItem({ event, podeAgir }: { event: AmortizacaoEvent; podeAgir: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(roundCents(event.valor));
  const [dataPagamento, setDataPagamento] = useState(event.data);
  const [origem, setOrigem] = useState<'proprio' | 'fgts'>(event.origem);
  const [modo, setModo] = useState<'term' | 'payment'>(event.modo);
  const [busy, setBusy] = useState<'edit' | 'delete' | null>(null);
  const [error, setError] = useState('');

  function abrirEdicao() {
    setValor(roundCents(event.valor));
    setDataPagamento(event.data);
    setOrigem(event.origem);
    setModo(event.modo);
    setError('');
    setEditando(true);
  }

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy('edit');
    setError('');
    let result;
    try {
      result = await editMovement(event.id, { valor, dataPagamento, origem, modo });
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
    const confirma = window.confirm(
      `Apagar a amortização de ${formatBRL(event.valor)}? Essa ação não pode ser desfeita.`,
    );
    if (!confirma) return;
    setBusy('delete');
    setError('');
    let result;
    try {
      result = await deleteMovement(event.id);
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
    <li className="flex gap-3 border-b border-border/60 py-3 last:border-b-0">
      <TimelineIcon kind="amortizacao" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm">{event.text}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatDataBr(event.data)}</p>
          </div>
          {podeAgir && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={abrirEdicao}
                disabled={busy !== null}
                aria-label="Editar amortização"
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void apagar()}
                disabled={busy !== null}
                aria-label="Apagar amortização"
              >
                <Trash2 className="size-3.5" />
                {busy === 'delete' ? 'Apagando...' : 'Apagar'}
              </Button>
            </div>
          )}
        </div>
        {editando && podeAgir && (
          <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="flex w-56 flex-col gap-1.5">
                <label htmlFor={`editarAmortValor-${event.id}`} className="text-sm font-medium text-foreground">
                  Valor amortizado (R$)
                </label>
                <MoneyInput
                  id={`editarAmortValor-${event.id}`}
                  value={valor}
                  onValid={setValor}
                  disabled={busy !== null}
                />
              </div>
              <div className="flex w-48 flex-col gap-1.5">
                <label htmlFor={`editarAmortData-${event.id}`} className="text-sm font-medium text-foreground">
                  Data do pagamento
                </label>
                <Input
                  id={`editarAmortData-${event.id}`}
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  disabled={busy !== null}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Origem</span>
                <OrigemRadios value={origem} onChange={setOrigem} disabled={busy !== null} />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">O que o banco fez</span>
                <ModoRadios value={modo} onChange={setModo} disabled={busy !== null} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)} disabled={busy !== null}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void salvar()}
                  disabled={busy !== null || valor <= 0 || !dataPagamento}
                >
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
        )}
        {!editando && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

const TIPO_BADGE: Record<'cadastro' | 'recalibracao' | 'atualizacao' | 'quitacao', string> = {
  cadastro: 'Cadastro',
  recalibracao: 'Recalibração',
  atualizacao: 'Atualização',
  quitacao: 'Quitação',
};

/**
 * Histórico agrupado por período do contrato: o marco de cada baseline
 * (cadastro, recalibrações, atualizações e quitação) com seus lançamentos
 * logo abaixo, ligados por uma linha vertical. O período vigente vem
 * primeiro; os anteriores ganham o selo "período anterior". No máximo 12
 * eventos por vez (limite global simples). Ações de editar/apagar só existem
 * fora do readOnly e no período vigente; os guards de lacuna/estado superado
 * ficam nas actions.
 */
export function Timeline({
  state,
  readOnly,
  quitado,
}: {
  state: Pick<PageState, 'historico' | 'states' | 'stateId'>;
  readOnly: boolean;
  quitado: boolean;
}) {
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const grupos = buildTimelineGroups(state);
  const podeAgir = !readOnly && !quitado;
  const totalEventos = grupos.reduce((soma, grupo) => soma + grupo.events.length, 0);

  let restante = mostrarTudo ? Number.POSITIVE_INFINITY : LIMITE_EVENTOS;
  const gruposVisiveis: typeof grupos = [];
  for (const grupo of grupos) {
    const events = grupo.events.slice(0, Math.max(0, restante));
    restante -= events.length;
    gruposVisiveis.push({ ...grupo, events });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">Histórico</h2>
      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
      ) : (
        <>
          <ol className="flex flex-col rounded-2xl bg-card px-4 py-1 shadow-sm ring-1 ring-foreground/10">
            {gruposVisiveis.map((grupo, indice) => (
              <li key={grupo.version} className="relative flex flex-col gap-2 py-3">
                {indice < gruposVisiveis.length - 1 && (
                  <span aria-hidden className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />
                )}
                <div className="relative flex items-start gap-3">
                  <TimelineIcon kind={grupo.marco.kind} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{grupo.marco.text}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {TIPO_BADGE[grupo.source]}
                      </span>
                      {!grupo.atual && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          período anterior
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatDataBr(grupo.marco.data)}</p>
                    {grupo.resumo && <p className="text-xs text-muted-foreground">{grupo.resumo}</p>}
                  </div>
                </div>
                {grupo.events.length > 0 && (
                  <ol className="ml-11 flex flex-col rounded-xl bg-muted/30 px-3">
                    {grupo.events.map((evento) => {
                      if (evento.kind === 'parcela') {
                        return (
                          <ParcelaItem
                            key={`parcela-${evento.id}`}
                            event={evento}
                            podeAgir={podeAgir && grupo.atual && evento.stateId === state.stateId}
                          />
                        );
                      }
                      if (evento.kind === 'amortizacao') {
                        return (
                          <AmortizacaoItem
                            key={`amortizacao-${evento.id}`}
                            event={evento}
                            podeAgir={podeAgir && grupo.atual && evento.stateId === state.stateId}
                          />
                        );
                      }
                      return null;
                    })}
                  </ol>
                )}
              </li>
            ))}
          </ol>
          {!mostrarTudo && totalEventos > LIMITE_EVENTOS && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMostrarTudo(true)}>
                Mostrar mais
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
