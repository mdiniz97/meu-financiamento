'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BANKS, DEFAULT_FORM, type FormState } from '@/lib/simulation-context';
import { parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function WizardForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validate(): string | null {
    const principal = parseBRLToNumber(form.principal);
    const annualRate = parseDecimal(form.annualRate);
    const months = Number(form.months);
    const trMonthly = parseDecimal(form.trMonthly);
    const insuranceMonthly = parseBRLToNumber(form.insuranceMonthly);
    if (!(principal > 0)) return 'Informe o valor financiado (maior que zero).';
    if (!(annualRate > 0)) return 'Informe a taxa anual (maior que zero).';
    if (!(months >= 1 && months <= 600)) return 'Prazo deve estar entre 1 e 600 meses.';
    if (!(trMonthly >= 0)) return 'Informe a TR mensal válida.';
    if (!(insuranceMonthly >= 0)) return 'Informe o seguro mensal válido.';
    if (
      form.portability &&
      !(parseDecimal(form.portability.annualRate) > 0)
    )
      return 'Informe a nova taxa da portabilidade (maior que zero).';
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
    sessionStorage.setItem('sim-input', JSON.stringify(form));
    router.push('/simulacao?name=');
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="principal">Valor financiado (R$)</Label>
                  <MoneyInput
                    id="principal"
                    value={parseBRLToNumber(form.principal)}
                    onValid={(v) => set('principal', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="annualRate">Taxa a.a. (%)</Label>
                  <NumericInput
                    id="annualRate"
                    value={parseDecimal(form.annualRate)}
                    parse={parseDecimal}
                    onValid={(v) => set('annualRate', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="months">Prazo (meses)</Label>
                  <NumericInput
                    id="months"
                    value={Number(form.months)}
                    parse={parseIntStrict}
                    onValid={(v) => set('months', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trMonthly">TR mensal (%)</Label>
                  <NumericInput
                    id="trMonthly"
                    value={parseDecimal(form.trMonthly)}
                    parse={parseDecimal}
                    onValid={(v) => set('trMonthly', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="insuranceMonthly">Seguro (R$/mês)</Label>
                  <MoneyInput
                    id="insuranceMonthly"
                    value={parseBRLToNumber(form.insuranceMonthly)}
                    onValid={(v) => set('insuranceMonthly', String(v))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Banco</Label>
                  <Select value={form.bank} onValueChange={(bank) => set('bank', String(bank))}>
                    <SelectTrigger className="w-full" size="sm">
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
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Sistema</Label>
                  <RadioGroup
                    value={form.system}
                    onValueChange={(system) => set('system', system as FormState['system'])}
                    className="flex flex-col gap-2"
                  >
                    <Label
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
                    </Label>
                    <Label
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
                    </Label>
                  </RadioGroup>
                </div>
              </div>
            </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">
              {form.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'}
            </Badge>
            <Button type="submit" className="min-w-32">
              Simular
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
