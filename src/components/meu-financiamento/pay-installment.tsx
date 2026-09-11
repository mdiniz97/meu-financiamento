'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { payInstallment } from '@/app/(app)/meu-financiamento/actions';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { splitPagamento } from '@/lib/finance/meu-financiamento/split-payment';
import { formatBRL } from '@/lib/utils';
import { EfeitoAporte, type EstadoProjecao } from './efeito-aporte';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Dialog de "Paguei": marca a próxima parcela pendente como paga com o valor
 * digitado e a data do pagamento. Usado tanto pelo card do mês quanto pelo
 * "Pagar" da tabela de parcelas. O conteúdo só é montado com o dialog aberto (o
 * estado inicial nasce fresco a cada abertura) e o botão fica desabilitado
 * durante o envio (duplo clique serializado pagaria duas parcelas seguidas). O
 * fechamento em voo é barrado pelo wrapper, que conhece o `pending`.
 */
export function PayInstallmentDialog({
  open,
  onOpenChange,
  parcelaNumero,
  defaultValor,
  dataVencimento,
  initialValor,
  initialAporte,
  estado,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcelaNumero: number;
  defaultValor: number;
  /** Vencimento estimado da parcela; pré-preenche a data do pagamento. */
  dataVencimento: string;
  /** Valor inicial do campo; defaultValor quando ausente. */
  initialValor?: number;
  /**
   * Aporte extra pré-preenchido (sugestão): o total vira
   * `roundCents(parcelaProjetada) + aporte`, em centavos exatos, para o split
   * do servidor receber o aporte pedido (ou até centavos acima).
   */
  initialAporte?: number;
  /** Estado vigente para pré-visualizar o efeito do excedente amortizado. */
  estado: EstadoProjecao;
  /** Chamado após o pagamento registrado e o refresh; o dialog fecha em ato. */
  onDone?: () => void;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v || !pending) onOpenChange(v);
      }}
    >
      {open && (
        <PayInstallmentForm
          parcelaNumero={parcelaNumero}
          defaultValor={defaultValor}
          dataVencimento={dataVencimento}
          initialValor={initialValor}
          initialAporte={initialAporte}
          estado={estado}
          pending={pending}
          onPendingChange={setPending}
          onCancel={() => onOpenChange(false)}
          onDone={() => {
            onDone?.();
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function PayInstallmentForm({
  parcelaNumero,
  defaultValor,
  dataVencimento,
  initialValor,
  initialAporte,
  estado,
  pending,
  onPendingChange,
  onCancel,
  onDone,
}: {
  parcelaNumero: number;
  defaultValor: number;
  dataVencimento: string;
  initialValor?: number;
  initialAporte?: number;
  estado: EstadoProjecao;
  pending: boolean;
  onPendingChange: (v: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  // Ids únicos por instância: o card do mês e o "Pagar" da tabela podem abrir o
  // mesmo dialog em momentos distintos, e ids fixos duplicariam o vínculo.
  const uid = useId();
  const valorId = `${uid}-valor`;
  const dataId = `${uid}-data`;
  const [valor, setValor] = useState(() => {
    if (initialAporte != null) return roundCents(roundCents(defaultValor) + initialAporte);
    return roundCents(initialValor ?? defaultValor);
  });
  const [dataPagamento, setDataPagamento] = useState(dataVencimento);
  const [excedenteModo, setExcedenteModo] = useState<'term' | 'payment'>('term');
  const [error, setError] = useState('');

  const split = splitPagamento(defaultValor, valor);
  const temExcedente = split.amortizacao > 0;

  async function handleSubmit() {
    if (pending || valor <= 0 || !dataPagamento) return;
    onPendingChange(true);
    setError('');
    // Vindo da sugestão, o aporte é enviado explícito: o servidor soma à
    // parcela projetada recalculada e o split grava exatamente esse valor.
    const aporteEfetivo = initialAporte != null ? roundCents(valor - roundCents(defaultValor)) : 0;
    let result;
    try {
      result = await payInstallment({
        valor,
        aporte: aporteEfetivo > 0 ? aporteEfetivo : undefined,
        dataPagamento,
        excedenteModo: temExcedente ? excedenteModo : undefined,
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
    onDone();
  }

  return (
    <DialogContent className="sm:max-w-2xl" data-pay-installment>
      <DialogHeader>
        <DialogTitle>Pagamento da parcela {parcelaNumero}</DialogTitle>
        <DialogDescription>
          Valor sugerido da parcela projetada: {formatBRL(defaultValor)}. Ajuste se pagou outro valor.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={valorId} className="text-sm font-medium text-foreground">
            Valor pago (R$)
          </label>
          <MoneyInput
            id={valorId}
            name="valor"
            value={valor}
            onValid={setValor}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dataId} className="text-sm font-medium text-foreground">
            Data do pagamento
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={dataId}
              name="dataPagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              disabled={pending}
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setDataPagamento(todayISO())}
              disabled={pending}
            >
              Definir hoje
            </Button>
          </div>
        </div>
      </div>
      {temExcedente && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3">
          <p className="text-sm">
            Parcela{' '}
            <strong className="font-mono font-semibold tabular-nums">{formatBRL(split.parcela)}</strong> + amortização
            extra{' '}
            <strong className="font-mono font-semibold tabular-nums">{formatBRL(split.amortizacao)}</strong>
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">O que o banco fez com a amortização</span>
            <RadioGroup
              value={excedenteModo}
              onValueChange={(v) => setExcedenteModo(v as 'term' | 'payment')}
              aria-label="O que o banco fez com a amortização"
              className="justify-start gap-6"
              disabled={pending}
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
          </div>
          <p className="text-xs text-muted-foreground">
            O excedente será registrado como amortização extra (dinheiro próprio).
          </p>
          <EfeitoAporte
            estado={estado}
            aporte={split.amortizacao}
            modo={excedenteModo}
            mostrarParcelaEstimada
          />
          {excedenteModo === 'payment' && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            >
              No modo &apos;reduzir a parcela&apos; o prazo não encurta; a economia vem da parcela menor.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={pending || valor <= 0 || !dataPagamento}
        >
          {pending ? 'Confirmando...' : 'Confirmar pagamento'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
