'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins } from 'lucide-react';
import {
  BANKS,
  NOVA_SIMULACAO_PREFILL_KEY,
  SIM_INPUT_KEY,
  parseStoredForm,
  type FormState,
} from '@/lib/simulation-context';
import { numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { FieldHelp } from '@/components/ui/field-help';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function WizardForm({ isUnlimited = false }: { isUnlimited?: boolean }) {
  const capturedPrefill = useRef<string | null | undefined>(undefined);
  const [initial, setInitial] = useState(() => ({ key: 'default', form: parseStoredForm(null) }));

  useEffect(() => {
    if (capturedPrefill.current === undefined) {
      capturedPrefill.current = sessionStorage.getItem(NOVA_SIMULACAO_PREFILL_KEY);
      sessionStorage.removeItem(NOVA_SIMULACAO_PREFILL_KEY);
    }
    if (capturedPrefill.current === null) return;

    const form = parseStoredForm(capturedPrefill.current);
    const frame = requestAnimationFrame(() => setInitial({ key: 'prefill', form }));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <WizardFormContent key={initial.key} initialForm={initial.form} isUnlimited={isUnlimited} />;
}

function WizardFormContent({ initialForm, isUnlimited }: { initialForm: FormState; isUnlimited: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [rateInvalid, setRateInvalid] = useState(false);
  const [monthsValid, setMonthsValid] = useState(true);
  const [trValid, setTrValid] = useState(true);
  const rateValidRef = useRef(true);
  const monthsValidRef = useRef(true);
  const trValidRef = useRef(true);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function setRateValidity(valid: boolean) {
    rateValidRef.current = valid;
    setRateInvalid(!valid);
  }

  function validate(): string | null {
    const principal = parseBRLToNumber(form.principal);
    const annualRate = parseDecimal(form.annualRate);
    const months = Number(form.months);
    const trMonthly = parseDecimal(form.trMonthly);
    const insuranceMonthly = parseBRLToNumber(form.insuranceMonthly);
    if (!(principal > 0)) return 'Informe o valor financiado (maior que zero).';
    if (!rateValidRef.current || rateInvalid) return 'Informe uma taxa válida.';
    if (!(annualRate >= 0)) return 'Informe uma taxa anual válida.';
    if (!monthsValidRef.current || !monthsValid || !Number.isInteger(months)) return 'Informe um prazo válido em meses inteiros.';
    if (!(months >= 1 && months <= 600)) return 'Prazo deve estar entre 1 e 600 meses.';
    if (!trValidRef.current || !trValid || !(trMonthly >= 0)) return 'Informe a TR mensal válida.';
    if (trMonthly > 10) return 'A TR mensal deve ficar entre 0% e 10%.';
    if (!(insuranceMonthly >= 0)) return 'Informe o seguro mensal válido.';
    if (
      form.portability &&
      !(parseDecimal(form.portability.annualRate) >= 0)
    )
      return 'Informe uma nova taxa válida para a portabilidade.';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    sessionStorage.setItem(SIM_INPUT_KEY, JSON.stringify(form));
    router.push('/simulacao');
  }

  return (
    <Card className="flex h-full w-full flex-col rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Simulação normal</CardTitle>
        <CardDescription>
          Informe os dados do financiamento e explore estratégias de amortização.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
          <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldHelp htmlFor="principal" label="Valor financiado (R$)" help="Valor que será emprestado pelo banco, depois de descontar a entrada do preço do imóvel.">
                   <MoneyInput
                     id="principal"
                     aria-describedby="principal-help"
                    value={parseBRLToNumber(form.principal)}
                    onValid={(v) => set('principal', numberToBRLInput(v))}
                  />
                </FieldHelp>
                 <RateField
                  id="annualRate"
                  label="Taxa de juros"
                   value={parseDecimal(form.annualRate)}
                    kind={form.annualRateKind}
                    minEffectiveAnnual={0}
                   onValueChange={(value) => set('annualRate', String(value))}
                   onValidityChange={setRateValidity}
                   onKindChange={(kind) => set('annualRateKind', kind)}
                />
                 <FieldHelp htmlFor="months" label="Prazo (meses)" help="Número de parcelas do contrato. Prazo maior reduz a parcela, mas costuma aumentar os juros totais.">
                  <NumericInput
                     id="months"
                     aria-describedby="months-help"
                    value={Number(form.months)}
                    parse={parseIntStrict}
                    onValid={(v) => set('months', String(v))}
                    onValidityChange={(valid) => {
                      monthsValidRef.current = valid;
                      setMonthsValid(valid);
                    }}
                  />
                 </FieldHelp>
                 <FieldHelp htmlFor="trMonthly" label="TR mensal (%)" help="Correção monetária mensal separada dos juros. Consulte a proposta do banco; use zero quando não houver TR.">
                  <NumericInput
                     id="trMonthly"
                     aria-describedby="trMonthly-help"
                    value={parseDecimal(form.trMonthly)}
                    parse={parseDecimal}
                    onValid={(v) => set('trMonthly', String(v))}
                    onValidityChange={(valid) => {
                      trValidRef.current = valid;
                      setTrValid(valid);
                    }}
                  />
                 </FieldHelp>
                 <FieldHelp htmlFor="insuranceMonthly" label="Seguro (R$/mês)" help="Soma mensal dos seguros do financiamento, encontrada na planilha ou proposta do banco; entra em cada parcela.">
                  <MoneyInput
                     id="insuranceMonthly"
                     aria-describedby="insuranceMonthly-help"
                    value={parseBRLToNumber(form.insuranceMonthly)}
                    onValid={(v) => set('insuranceMonthly', numberToBRLInput(v))}
                  />
                 </FieldHelp>
                 <FieldHelp htmlFor="bank" label="Banco" help="Instituição que oferece o contrato. Nome aparece nos resultados e relatórios.">
                  <Select value={form.bank} onValueChange={(bank) => set('bank', String(bank))}>
                     <SelectTrigger id="bank" aria-describedby="bank-help" className="w-full" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                 </FieldHelp>
                 <FieldHelp htmlFor="system" label="Sistema" help="PRICE mantém parcelas mais estáveis; SAC amortiza mais no início e faz as parcelas caírem ao longo do contrato.">
                   <RadioGroup
                     id="system"
                     aria-describedby="system-help"
                     aria-label="Sistema"
                    value={form.system}
                    onValueChange={(system) => set('system', system as FormState['system'])}
                    className="flex flex-col gap-2"
                  >
                     <label
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal transition-colors ${
                        form.system === 'PRICE' ? 'border-[#820AD1] bg-primary/5 dark:bg-[#820AD1]/15' : 'border-border'
                      }`}
                    >
                      <RadioGroupItem value="PRICE" />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">PRICE</span>
                        <span className="text-xs leading-tight text-muted-foreground">
                          Parcela constante; paga mais juros no início.
                        </span>
                      </span>
                     </label>
                     <label
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal transition-colors ${
                        form.system === 'SAC' ? 'border-[#820AD1] bg-primary/5 dark:bg-[#820AD1]/15' : 'border-border'
                      }`}
                    >
                      <RadioGroupItem value="SAC" />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">SAC</span>
                        <span className="text-xs leading-tight text-muted-foreground">
                          Amortização fixa; parcela cai, dívida abate desde o mês 1.
                        </span>
                      </span>
                     </label>
                  </RadioGroup>
                 </FieldHelp>
              </div>
            </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">
              {form.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'}
            </Badge>
            <Button type="submit" className="min-w-32">
              Simular
              {!isUnlimited && (
                <span aria-hidden className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold">
                  <Coins className="size-3.5" /> -1
                </span>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
