'use client';

import { useEffect, useRef, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { calcularConsorcioOuInvestir, type ConsorcioInvestirResult } from '@/lib/finance/consorcio-investir';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';

const DEFAULTS = {
  valor: '300000,00',
  prazo: '240',
  taxaAdmin: '18',
  selic: '10.5',
};

export function ConsorcioInvestirCalculator({
  selicAnnual,
}: {
  selicAnnual: number | null;
}) {
  const [form, setForm] = useState({
    ...DEFAULTS,
    selic: selicAnnual === null ? '10.5' : String(selicAnnual),
  });
  const [result, setResult] = useState<ConsorcioInvestirResult | null>(null);
  const [resultForm, setResultForm] = useState<typeof form | null>(null);
  const [error, setError] = useState('');
  const selicResultado = resultForm ? parseDecimal(resultForm.selic) : NaN;
  const selicLabel = Number.isFinite(selicResultado)
    ? selicResultado.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    : '-';

  const savedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result || !resultForm) return;
    if (savedFpRef.current === null) {
      savedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('consorcio-investir-saved-fp');
    }
    const fp = JSON.stringify(resultForm);
    if (savedFpRef.current === fp) return;
    savedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('consorcio-investir-saved-fp', fp);
    }
    (async () => {
      await saveToolSimulation({
        name: `Consórcio ou investir ${new Date().toLocaleDateString('pt-BR')}`,
        system: 'Consórcio vs investir',
        payload: { form: resultForm },
        result,
        charge: false,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function calcular() {
    setError('');
    const valor = parseBRLToNumber(form.valor);
    const prazo = Number(form.prazo);
    const taxaAdmin = parseDecimal(form.taxaAdmin);
    const selic = parseDecimal(form.selic);

    if (!(valor > 0)) return setError('Informe o valor do crédito.');
    if (!(prazo >= 1 && prazo <= 600)) return setError('Prazo deve ficar entre 1 e 600 meses.');
    if (!(taxaAdmin >= 0)) return setError('Taxa de administração inválida.');
    if (!(selic >= 0)) return setError('Informe a taxa de investimento.');

    try {
      const r = calcularConsorcioOuInvestir({
        valor,
        prazoMeses: prazo,
        taxaAdminPct: taxaAdmin,
        selicAnual: selic / 100,
      });
      setResult(r);
      setResultForm(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldHelp htmlFor="ciValor" label="Valor do crédito (R$)" help="O valor da carta de crédito ou do imóvel.">
            <MoneyInput id="ciValor" aria-describedby="ciValor-help" value={parseBRLToNumber(form.valor)} onValid={(v) => set('valor', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ciPrazo" label="Prazo do consórcio (meses)" help="Em quantos meses o consórcio é pago.">
            <NumericInput id="ciPrazo" aria-describedby="ciPrazo-help" value={Number(form.prazo)} parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))} onValid={(v) => set('prazo', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ciAdmin" label="Taxa de administração (% do crédito)" help="Ex.: 18% é o comum no consórcio imobiliário.">
            <NumericInput id="ciAdmin" aria-describedby="ciAdmin-help" value={parseDecimal(form.taxaAdmin)} parse={parseDecimal} onValid={(v) => set('taxaAdmin', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ciSelic" label="Taxa de investimento (Selic % a.a.)" help="Já vem com a Selic atual do BACEN.">
            <NumericInput id="ciSelic" aria-describedby="ciSelic-help" value={parseDecimal(form.selic)} parse={parseDecimal} onValid={(v) => set('selic', String(v))} />
          </FieldHelp>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="ml-auto flex items-center gap-2">
            {result ? (
              <Button type="button" onClick={() => { setResult(null); setResultForm(null); }}>
                Nova simulação
              </Button>
            ) : (
              <Button type="button" onClick={calcular}>
                Comparar
              </Button>
            )}
          </div>
      </div>

      {result && (

        <div className="flex flex-col gap-4 rounded-2xl bg-muted/50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-lg font-semibold">Resultado</h3>
            <p className="text-sm text-muted-foreground">
              A mesma parcela de {formatBRL(result.parcelaMensal)}/mês em cada caminho.
            </p>
          </div>
            <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
              <p className="text-sm">
                <strong className="text-[#820AD1]">Investindo, você compra à vista no mês {result.mesCompraAvista} (~{result.mesCompraAvistaAnos} anos):</strong>{' '}
                aplicando {formatBRL(result.parcelaMensal)}/mês a {selicLabel}% a.a., seu
                dinheiro atinge {formatBRL(result.valor)} e o imóvel é seu sem taxa de administração.
                O consórcio, no pior caso, só entrega a carta no fim do prazo ({result.prazoMeses} meses),
                depois de pagar {formatBRL(result.totalConsorcio)} no total (incluindo{' '}
                <strong>{formatBRL(result.custoAdministracao)} de taxa de administração</strong>).
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="flex items-start gap-2 text-sm">
                <AlarmClock className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Quando o consórcio vale?</strong> Só se a contemplação sair antes do mês{' '}
                  {result.mesCompraAvista}: sorteado ou com lance, você recebe a carta e para de
                  esperar. Depois desse mês, seu dinheiro investido já teria juntado o valor, e o
                  consórcio só soma a taxa de administração. Contemplação nunca é garantida.
                </span>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Parcela mensal', desc: 'Mesmo desembolso nos dois caminhos', value: formatBRL(result.parcelaMensal) },
                { label: 'Investindo, compra no mês', desc: `Quando a aplicação atinge ${formatBRL(result.valor)}`, value: `${result.mesCompraAvista} meses` },
                { label: 'Consórcio entrega no mês', desc: 'Pior caso: contemplação só no fim do prazo', value: `${result.prazoMeses} meses` },
                { label: 'Taxa de administração', desc: 'Custo do consórcio além do crédito', value: formatBRL(result.custoAdministracao) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="font-mono tabular-nums text-lg font-semibold">{item.value}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Como funciona</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Consórcio:</strong> você paga o crédito
                  diluído + {result.taxaAdminPct}% de taxa de administração ({formatBRL(result.custoAdministracao)}),
                  mas só recebe a carta quando for contemplado por sorteio ou lance.
                </li>
                <li>
                  <strong className="text-foreground">Investindo:</strong> a mesma parcela aplicada
                  todo mês rende {selicLabel}% a.a. e compra à vista quando atinge o
                  valor, sem pagar taxa nem depender de sorteio.
                </li>
                <li>
                  Se a contemplação não sair antes do mês {result.mesCompraAvista}, o investimento
                  chega ao valor primeiro.
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              Simulação simplificada: Selic constante e sem considerar seguros, fundo de reserva
              ou reajustes do consórcio. Não é recomendação de investimento.
            </p>
        </div>
      )}
    </div>
  );
}
