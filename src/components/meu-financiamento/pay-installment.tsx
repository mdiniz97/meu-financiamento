'use client';

import { useId, useMemo, useState } from 'react';
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
import { opcoesSugestao } from '@/lib/finance/meu-financiamento/sugestao-opcoes';
import { formatBRL } from '@/lib/utils';
import { EfeitoAporte, type EstadoProjecao } from './efeito-aporte';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Seletor de "o que o banco fez com a amortização", compartilhado pelo modal de
 * pagamento e pela edição do pagamento com aporte vinculado.
 */
export function ModoRadios({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: 'term' | 'payment';
  onChange: (v: 'term' | 'payment') => void;
  disabled: boolean;
  /** Prefixo opcional dos ids, para o label clicar o radio correto. */
  idPrefix?: string;
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
        <RadioGroupItem value="term" id={idPrefix ? `${idPrefix}-term` : undefined} />
        Reduziu o prazo (parcela igual)
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <RadioGroupItem value="payment" id={idPrefix ? `${idPrefix}-payment` : undefined} />
        Reduziu a parcela (prazo igual)
      </label>
    </RadioGroup>
  );
}

/**
 * Dialog de "Paguei": marca a próxima parcela pendente como paga com o valor
 * digitado e a data do pagamento, com uma seção OPCIONAL de amortização extra
 * (aporte próprio, atalhos da sugestão, prévia do efeito e modo). O total é
 * parcela + aporte. Usado pelo card do mês e pelo "Pagar" da tabela. O conteúdo
 * só é montado com o dialog aberto (o estado inicial nasce fresco a cada
 * abertura) e o botão fica desabilitado durante o envio (duplo clique
 * serializado pagaria duas parcelas seguidas). O fechamento em voo é barrado
 * pelo wrapper, que conhece o `pending`.
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
  /** Aporte extra pré-preenchido (sugestão), enviado explícito à action. */
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
  const aporteId = `${uid}-aporte`;
  const dataId = `${uid}-data`;
  const parcelaProjetada = roundCents(defaultValor);
  const [valorPago, setValorPago] = useState(() => roundCents(initialValor ?? defaultValor));
  const [aporte, setAporte] = useState(() => (initialAporte != null ? roundCents(initialAporte) : 0));
  const [dataPagamento, setDataPagamento] = useState(dataVencimento);
  const [modo, setModo] = useState<'term' | 'payment'>('term');
  const [error, setError] = useState('');

  const { params, baseline, pagas, extras, projecao } = estado;
  const ho = todayISO();
  const opcoes = useMemo(
    () => opcoesSugestao({ params, baseline, pagas, extras, projecao }, ho),
    [params, baseline, pagas, extras, projecao, ho],
  );

  const temAporte = aporte > 0;
  // Sem aporte explícito, manter o comportamento antigo: um valor acima da
  // parcela projetada é dividido pelo helper de split do servidor.
  const split = splitPagamento(parcelaProjetada, valorPago);
  const amortizacao = temAporte ? aporte : split.amortizacao;
  const temAmortizacao = amortizacao > 0.005;
  const parcelaEfetiva = temAporte ? parcelaProjetada : split.parcela;
  // O Total reflete o que a action grava: com aporte, o servidor fixa a parcela
  // na projetada e soma o aporte (ignora um "Valor pago" custom, que fica
  // travado); sem aporte, parcela + amortização do split do próprio valor pago.
  const total = roundCents(parcelaEfetiva + amortizacao);

  async function handleSubmit() {
    if (pending || valorPago <= 0 || !dataPagamento) return;
    onPendingChange(true);
    setError('');
    let result;
    try {
      // Com aporte explícito o servidor recalcula o total como
      // `projetada + aporte`, então o split grava exatamente o valor pedido.
      // Sem aporte, o valor total é enviado e o split do servidor decide.
      result = temAporte
        ? await payInstallment({ aporte, dataPagamento, excedenteModo: modo })
        : await payInstallment({
            valor: valorPago,
            dataPagamento,
            excedenteModo: temAmortizacao ? modo : undefined,
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
            value={valorPago}
            onValid={setValorPago}
            disabled={pending || temAporte}
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

      <div className="flex flex-col gap-3 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Amortização extra (opcional)</p>
          <p className="text-xs text-muted-foreground">
            Some um aporte à parcela deste mês para quitar mais rápido. O total é parcela + aporte.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={aporteId} className="text-sm font-medium text-foreground">
            Amortização extra (R$)
          </label>
          <MoneyInput
            id={aporteId}
            name="aporte"
            value={aporte}
            onValid={setAporte}
            disabled={pending}
          />
        </div>
        {opcoes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opcoes.map((opcao) => (
              <Button
                key={opcao.id}
                type="button"
                variant={opcao.id === 'ideal' ? 'default' : 'outline'}
                size="sm"
                aria-label={`Usar ${opcao.aria}`}
                onClick={() => setAporte(opcao.aporte)}
                disabled={pending}
              >
                {opcao.titulo} · {formatBRL(opcao.aporte)}
              </Button>
            ))}
          </div>
        )}
        {temAmortizacao && (
          <>
            <p className="text-sm">
              Parcela{' '}
              <strong className="font-mono font-semibold tabular-nums">{formatBRL(parcelaEfetiva)}</strong> + amortização
              extra{' '}
              <strong className="font-mono font-semibold tabular-nums">{formatBRL(amortizacao)}</strong>
            </p>
            <p className="text-sm font-medium text-foreground">
              Total: <span className="font-mono tabular-nums">{formatBRL(total)}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">O que o banco fez com a amortização</span>
              <ModoRadios value={modo} onChange={setModo} disabled={pending} />
            </div>
            <EfeitoAporte
              estado={estado}
              aporte={amortizacao}
              modo={modo}
              mostrarParcelaEstimada
            />
            {temAporte && (
              <p className="text-xs text-muted-foreground">
                O excedente será registrado como amortização extra (dinheiro próprio).
              </p>
            )}
            {modo === 'payment' && (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              >
                No modo &apos;reduzir a parcela&apos; o prazo não encurta; a economia vem da parcela menor.
              </p>
            )}
          </>
        )}
      </div>

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
          disabled={pending || valorPago <= 0 || !dataPagamento}
        >
          {pending ? 'Confirmando...' : 'Confirmar pagamento'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
