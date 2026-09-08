'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteMovement, editMovement, registerAmortization } from '@/app/(app)/meu-financiamento/actions';
import type { AmortizacaoComId } from '@/lib/meu-financiamento/repo';
import { formatDataBr, todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function OrigemLabel({ origem }: { origem: 'proprio' | 'fgts' }) {
  return origem === 'fgts' ? 'FGTS' : 'Dinheiro próprio';
}

export function ModoLabel({ modo }: { modo: 'term' | 'payment' }) {
  return modo === 'term' ? 'Reduziu o prazo (parcela igual)' : 'Reduziu a parcela (prazo igual)';
}

function OrigemRadios({
  value,
  onChange,
  disabled,
}: {
  value: 'proprio' | 'fgts';
  onChange: (v: 'proprio' | 'fgts') => void;
  disabled: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as 'proprio' | 'fgts')}
      aria-label="Origem dos recursos"
      className="grid-flow-col justify-start gap-6"
      disabled={disabled}
    >
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="proprio" />
        Dinheiro próprio
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="fgts" />
        FGTS
      </label>
    </RadioGroup>
  );
}

function ModoRadios({
  value,
  onChange,
  disabled,
}: {
  value: 'term' | 'payment';
  onChange: (v: 'term' | 'payment') => void;
  disabled: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as 'term' | 'payment')}
      aria-label="O que o banco fez"
      className="justify-start gap-6"
      disabled={disabled}
    >
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="term" />
        Reduziu o prazo (parcela igual)
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="payment" />
        Reduziu a parcela (prazo igual)
      </label>
    </RadioGroup>
  );
}

function AmortizacaoRow({ amort, readOnly }: { amort: AmortizacaoComId; readOnly: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(roundCents(amort.valor));
  const [dataPagamento, setDataPagamento] = useState(amort.dataPagamento);
  const [origem, setOrigem] = useState<'proprio' | 'fgts'>(amort.origem);
  const [modo, setModo] = useState<'term' | 'payment'>(amort.modo);
  const [busy, setBusy] = useState<'edit' | 'delete' | null>(null);
  const [error, setError] = useState('');

  function abrirEdicao() {
    setValor(roundCents(amort.valor));
    setDataPagamento(amort.dataPagamento);
    setOrigem(amort.origem);
    setModo(amort.modo);
    setError('');
    setEditando(true);
  }

  async function salvar() {
    if (busy || valor <= 0 || !dataPagamento) return;
    setBusy('edit');
    setError('');
    let result;
    try {
      result = await editMovement(amort.id, { valor, dataPagamento, origem, modo });
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
      `Apagar a amortização de ${formatBRL(amort.valor)}? Essa ação não pode ser desfeita.`,
    );
    if (!confirma) return;
    setBusy('delete');
    setError('');
    let result;
    try {
      result = await deleteMovement(amort.id);
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
        <TableCell>{formatDataBr(amort.dataPagamento)}</TableCell>
        <TableCell className="font-mono tabular-nums">{formatBRL(amort.valor)}</TableCell>
        <TableCell><OrigemLabel origem={amort.origem} /></TableCell>
        <TableCell><ModoLabel modo={amort.modo} /></TableCell>
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
          <TableCell colSpan={readOnly ? 4 : 5} className="bg-muted/30 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="flex w-56 flex-col gap-1.5">
                  <label htmlFor={`editarAmortValor-${amort.id}`} className="text-sm font-medium text-foreground">
                    Valor amortizado (R$)
                  </label>
                  <MoneyInput
                    id={`editarAmortValor-${amort.id}`}
                    value={valor}
                    onValid={setValor}
                    disabled={busy !== null}
                  />
                </div>
                <div className="flex w-48 flex-col gap-1.5">
                  <label htmlFor={`editarAmortData-${amort.id}`} className="text-sm font-medium text-foreground">
                    Data do pagamento
                  </label>
                  <Input
                    id={`editarAmortData-${amort.id}`}
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
          <TableCell colSpan={5} className="p-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Formulário de registro de amortização. Só é montado com o dialog aberto
 * (estado inicial fresco a cada abertura); o submit fica desabilitado durante
 * o envio (duplo clique serializado inseriria duas linhas iguais, não há
 * índice único). O fechamento em voo é barrado pelo pai, que conhece o
 * `pending`.
 */
function AmortizacaoForm({
  pending,
  onPendingChange,
  onClose,
}: {
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(0);
  const [dataPagamento, setDataPagamento] = useState(todayISO());
  const [origem, setOrigem] = useState<'proprio' | 'fgts'>('proprio');
  const [modo, setModo] = useState<'term' | 'payment'>('term');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (pending || valor <= 0 || !dataPagamento) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      result = await registerAmortization({ valor, dataPagamento, origem, modo });
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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Registrar amortização extra</DialogTitle>
        <DialogDescription>
          Amortização feita por fora da parcela, como o banco registrou no extrato.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amortValor" className="text-sm font-medium text-foreground">
            Valor amortizado (R$)
          </label>
          <MoneyInput id="amortValor" name="valor" value={valor} onValid={setValor} disabled={pending} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amortData" className="text-sm font-medium text-foreground">
            Data do pagamento
          </label>
          <Input
            id="amortData"
            name="dataPagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Origem</span>
          <OrigemRadios value={origem} onChange={setOrigem} disabled={pending} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">O que o banco fez</span>
          <ModoRadios value={modo} onChange={setModo} disabled={pending} />
        </div>
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
        <Button type="button" onClick={() => void handleSubmit()} disabled={pending || valor <= 0 || !dataPagamento}>
          {pending ? 'Registrando...' : 'Confirmar amortização'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Seção "Amortizações extras" do dashboard: botão "Registrei amortização" abre
 * o dialog de registro; o histórico lista data, valor, origem e modo com
 * editar/apagar por linha. Ações somem quando readOnly; o registro também some
 * quando o contrato está quitado.
 */
export function AmortizacoesSection({
  extras,
  readOnly,
  quitado,
}: {
  extras: AmortizacaoComId[];
  readOnly: boolean;
  /** Contrato com saldo efetivo zerado: sem novos lançamentos. */
  quitado: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const podeRegistrar = !readOnly && !quitado;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Amortizações extras</h2>
        {podeRegistrar && (
          <Button type="button" onClick={() => setOpen(true)}>
            Registrei amortização
          </Button>
        )}
      </div>
      {extras.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma amortização extra ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data do pagamento</TableHead>
                <TableHead className="text-right">Valor amortizado</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Modo</TableHead>
                {!readOnly && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {extras.map((a) => (
                <AmortizacaoRow key={a.id} amort={a} readOnly={readOnly} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v || !pending) setOpen(v);
        }}
      >
        {open && (
          <AmortizacaoForm pending={pending} onPendingChange={setPending} onClose={() => setOpen(false)} />
        )}
      </Dialog>
    </section>
  );
}
