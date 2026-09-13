'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Search } from 'lucide-react';
import {
  calculateAffordability,
  calculatePaymentAffordability,
  type AffordabilityResult,
  type PaymentAffordabilityResult,
} from '@/lib/finance/affordability';
import { BANKS, SIM_INPUT_KEY } from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeRate, type RateKind } from '@/lib/finance/rates';

type AffordabilityMode = 'income' | 'payment';

export interface AffordabilityDefaults {
  monthlyIncome?: number;
  paymentCap?: number;
  availableCash?: number;
  initialCosts?: number;
  annualRate?: number;
  annualRateKind?: RateKind;
  trMonthly?: number;
  insuranceMonthly?: number;
  bank?: string;
  months?: number;
}

export interface AffordabilitySelection {
  principal: number;
  system: 'PRICE' | 'SAC';
  monthlyBudget: number;
  annualRate: number;
  annualRateKind: RateKind;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  months: number;
}

export function AffordabilityCalculator({
  compact = false,
  defaults = {},
  onUse,
}: {
  compact?: boolean;
  defaults?: AffordabilityDefaults;
  onUse?: (selection: AffordabilitySelection) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AffordabilityMode>('income');
  const [monthlyIncome, setMonthlyIncome] = useState(defaults.monthlyIncome ?? 20000);
  const [incomePaymentCap, setIncomePaymentCap] = useState(defaults.paymentCap ?? 0);
  const [directPaymentCap, setDirectPaymentCap] = useState(defaults.paymentCap ?? 5000);
  const [availableCash, setAvailableCash] = useState(defaults.availableCash ?? 250000);
  const [initialCosts, setInitialCosts] = useState(defaults.initialCosts ?? 20000);
  const [annualRate, setAnnualRate] = useState(defaults.annualRate ?? 10.5);
  const [annualRateKind, setAnnualRateKind] = useState<RateKind>(defaults.annualRateKind ?? 'effective-annual');
  const [trMonthly, setTrMonthly] = useState(defaults.trMonthly ?? 0.17);
  const [insuranceMonthly, setInsuranceMonthly] = useState(defaults.insuranceMonthly ?? 100);
  const [bank, setBank] = useState(defaults.bank ?? 'Caixa');
  const [months, setMonths] = useState(defaults.months ?? 360);
  const [incomeResult, setIncomeResult] = useState<AffordabilityResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentAffordabilityResult | null>(null);
  const [error, setError] = useState('');
  const [annualRateValid, setAnnualRateValid] = useState(true);
  const [monthlyIncomeValid, setMonthlyIncomeValid] = useState(true);
  const [incomePaymentCapValid, setIncomePaymentCapValid] = useState(true);
  const [directPaymentCapValid, setDirectPaymentCapValid] = useState(true);
  const [availableCashValid, setAvailableCashValid] = useState(true);
  const [initialCostsValid, setInitialCostsValid] = useState(true);
  const [insuranceMonthlyValid, setInsuranceMonthlyValid] = useState(true);
  const [monthsValid, setMonthsValid] = useState(true);
  const [trMonthlyValid, setTrMonthlyValid] = useState(true);

  function onInputsChanged() {
    setIncomeResult(null);
    setPaymentResult(null);
    setError('');
  }

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      onInputsChanged();
      setter(value);
    };
  }

  function updateValidity(setter: (valid: boolean) => void) {
    return (valid: boolean) => {
      if (!valid) onInputsChanged();
      setter(valid);
    };
  }

  function calcular() {
    setError('');
    const fieldsValid = availableCashValid && initialCostsValid && insuranceMonthlyValid && monthsValid && trMonthlyValid && (
      mode === 'income'
        ? monthlyIncomeValid && incomePaymentCapValid
        : directPaymentCapValid
    );
    if (!annualRateValid || !fieldsValid) {
      if (mode === 'income') setIncomeResult(null);
      else setPaymentResult(null);
      setError(!annualRateValid ? 'Informe uma taxa válida.' : 'Corrija os campos inválidos.');
      return;
    }
    try {
      const shared = {
        availableCash,
        initialCosts,
        annualRate: normalizeRate(annualRate, annualRateKind).effectiveAnnual,
        trMonthly: trMonthly / 100,
        insuranceMonthly,
        bank,
        months,
      };
      if (mode === 'income') {
        setIncomeResult(calculateAffordability({
          ...shared,
          monthlyIncome,
          paymentCap: incomePaymentCap,
        }));
      } else {
        setPaymentResult(calculatePaymentAffordability({ ...shared, maxPayment: directPaymentCap }));
      }
    } catch (e) {
      if (mode === 'income') setIncomeResult(null);
      else setPaymentResult(null);
      setError(e instanceof Error ? e.message : 'Não foi possível calcular.');
    }
  }

  function usar(principal: number, system: 'PRICE' | 'SAC', monthlyBudget: number) {
    if (!Number.isFinite(principal) || principal <= 0) return;
    const effectiveAnnualPercent = normalizeRate(annualRate, annualRateKind).effectiveAnnual * 100;
    const selection = {
      principal,
      system,
      monthlyBudget,
      annualRate: effectiveAnnualPercent,
      annualRateKind: 'effective-annual' as const,
      trMonthly,
      insuranceMonthly,
      bank,
      months,
    };
    if (onUse) {
      onUse(selection);
      return;
    }
    sessionStorage.setItem(SIM_INPUT_KEY, JSON.stringify({
      system,
      principal: numberToBRLInput(principal),
      annualRate: String(effectiveAnnualPercent),
      annualRateKind: 'effective-annual',
      months: String(months),
      trMonthly: String(trMonthly),
      insuranceMonthly: numberToBRLInput(insuranceMonthly),
      bank,
      lumpSum: [],
      extraMonthlyPct: '0',
      extraMonthlyPctStart: '',
      extraMonthlyPctUntil: '',
      fixedPaymentStart: '',
      fgtsAnnual: '0',
      fgtsStartMonth: '12',
      fgtsUntilMonth: '',
      recurringExtra: null,
      fixedPayment: '',
      fixedPaymentUntil: '',
      paySacParcela: false,
      reduceMode: 'term',
      portability: null,
    }));
    router.push('/simulacao');
  }

  function renderPanel(panelMode: AffordabilityMode) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {panelMode === 'income' && (
            <Field label="Renda mensal familiar (R$)" id="affIncome" help="Some as rendas mensais da família que o banco aceita comprovar; ela define os limites de 20%, 25% e 30%.">
              <MoneyInput id="affIncome" aria-describedby="affIncome-help" value={monthlyIncome} onValid={update(setMonthlyIncome)} onValidityChange={updateValidity(setMonthlyIncomeValid)} />
            </Field>
          )}
          <Field
            label={panelMode === 'income' ? 'Parcela máxima (R$) · opcional' : 'Parcela máxima (R$)'}
            id="affCap"
            help={panelMode === 'income' ? 'Teto que cabe no seu orçamento. Quando preenchido, limita a parcela mesmo que a renda permita mais.' : 'Maior prestação mensal que cabe no orçamento. O cálculo usa esse teto sem exigir renda.'}
          >
            <MoneyInput
              id="affCap"
              aria-describedby="affCap-help"
              value={panelMode === 'income' ? incomePaymentCap : directPaymentCap}
              onValid={update(panelMode === 'income' ? setIncomePaymentCap : setDirectPaymentCap)}
              onValidityChange={updateValidity(panelMode === 'income' ? setIncomePaymentCapValid : setDirectPaymentCapValid)}
            />
          </Field>
          <Field label={panelMode === 'income' ? 'Dinheiro disponível (R$)' : 'Entrada disponível (R$) · opcional'} id="affCash" help="Total guardado para entrada e despesas da compra. Custos iniciais serão descontados deste valor.">
            <MoneyInput id="affCash" aria-describedby="affCash-help" value={availableCash} onValid={update(setAvailableCash)} onValidityChange={updateValidity(setAvailableCashValid)} />
          </Field>
          <Field label={panelMode === 'income' ? 'Custos iniciais reservados (R$)' : 'Custos iniciais (R$) · opcionais'} id="affCosts" help="Reserve ITBI, cartório, avaliação e mudança. Esse valor não entra na entrada do imóvel.">
            <MoneyInput id="affCosts" aria-describedby="affCosts-help" value={initialCosts} onValid={update(setInitialCosts)} onValidityChange={updateValidity(setInitialCostsValid)} />
          </Field>
          <Field label="Prazo (meses)" id="affMonths" help="Quantidade de parcelas usada para estimar o imóvel máximo; prazo maior pode elevar o total de juros.">
            <NumericInput id="affMonths" aria-describedby="affMonths-help" value={months} parse={parseIntStrict} onValid={update(setMonths)} onValidityChange={updateValidity(setMonthsValid)} />
          </Field>
          <RateField id="affRate" label="Taxa de juros" value={annualRate} kind={annualRateKind} minEffectiveAnnual={0} onValueChange={update(setAnnualRate)} onKindChange={update(setAnnualRateKind)} onValidityChange={updateValidity(setAnnualRateValid)} />
          <Field label="TR mensal (%)" id="affTr" help="Correção monetária mensal separada dos juros. Ela pode elevar parcelas futuras e reduzir o imóvel seguro.">
            <NumericInput id="affTr" aria-describedby="affTr-help" value={trMonthly} parse={(s) => Number(s.replace(',', '.'))} onValid={update(setTrMonthly)} onValidityChange={updateValidity(setTrMonthlyValid)} />
          </Field>
          <Field label="Seguro (R$/mês)" id="affInsurance" help="Custo mensal dos seguros cobrado com a prestação; reduz quanto da parcela pode amortizar o imóvel.">
            <MoneyInput id="affInsurance" aria-describedby="affInsurance-help" value={insuranceMonthly} onValid={update(setInsuranceMonthly)} onValidityChange={updateValidity(setInsuranceMonthlyValid)} />
          </Field>
          <FieldHelp htmlFor="affBank" label="Banco" help="Instituição cujas condições serão usadas e identificadas na simulação.">
            <Select value={bank} onValueChange={(v) => update(setBank)(String(v))}>
              <SelectTrigger id="affBank" aria-describedby="affBank-help" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldHelp>
        </div>

        <p className="text-xs text-muted-foreground">
          {panelMode === 'income'
            ? 'Dinheiro disponível menos custos iniciais vira entrada. Cenários usam 20%, 25% e 30% da renda; se você informar parcela máxima, ela limita todos.'
            : 'Entrada disponível menos custos iniciais vira entrada líquida. O máximo seguro mantém todas as parcelas dentro do teto, mesmo com TR.'}
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={calcular}>
            <Search className="size-4" /> {panelMode === 'income' ? 'Calcular imóvel máximo' : 'Calcular valor financiável'}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {panelMode === 'income' && incomeResult && (

          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">
              Entrada disponível após custos: <strong>{formatBRL(incomeResult.availableDownPayment)}</strong>
            </p>
            <div className={compact ? 'flex flex-col gap-3' : 'grid gap-4 lg:grid-cols-3'}>
              {incomeResult.scenarios.map((scenario) => (
                <div
                  key={scenario.key}
                  className={`flex flex-col gap-3 rounded-2xl p-4 shadow-sm ${
                    scenario.key === 'recommended' ? 'bg-primary/5 ring-2 ring-[#820AD1]' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{scenario.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {(scenario.commitmentPct * 100).toFixed(0)}% da renda · {formatBRL(scenario.monthlyBudget)}/mês
                    </span>
                  </div>
                  {(['PRICE', 'SAC'] as const).map((system) => {
                    const item = scenario.systems[system];
                    const canTransfer = item.maxFinancing > 0;
                    return (
                      <div key={system} className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-border">
                        <span className="text-xs font-semibold text-primary">{system}</span>
                        <span className="text-xs text-muted-foreground">Imóvel máximo</span>
                        <span className="text-lg font-semibold">{formatBRL(item.maxPropertyValue)}</span>
                        <span className="text-xs text-muted-foreground">
                          Financia {formatBRL(item.maxFinancing)} · parcela inicial {formatBRL(item.firstPayment)}
                        </span>
                        {!canTransfer && <span className="text-xs text-muted-foreground">Nenhum valor financiável</span>}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          disabled={!canTransfer}
                          onClick={() => usar(item.maxFinancing, system, scenario.monthlyBudget)}
                        >
                          <Home className="size-3.5" /> Levar ao simulador
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        {panelMode === 'payment' && paymentResult && (

          <PaymentCapacityCards
            result={paymentResult}
            compact={compact}
            monthlyBudget={directPaymentCap}
            onUse={usar}
          />
        )}
      </div>
    );
  }

  const tabs = (
    <Tabs value={mode} onValueChange={(value) => {
      if (value !== 'income' && value !== 'payment') return;
      setMode(value);
      setIncomeResult(null);
      setPaymentResult(null);
      setError('');
      setAnnualRateValid(true);
      setMonthlyIncomeValid(true);
      setIncomePaymentCapValid(true);
      setDirectPaymentCapValid(true);
      setAvailableCashValid(true);
      setInitialCostsValid(true);
      setInsuranceMonthlyValid(true);
      setMonthsValid(true);
      setTrMonthlyValid(true);
    }} className="gap-5">
      <TabsList className="h-10 w-full sm:w-fit" aria-label="Forma de cálculo">
        <TabsTrigger value="income" className="px-4">Por renda e entrada</TabsTrigger>
        <TabsTrigger value="payment" className="px-4">Por parcela</TabsTrigger>
      </TabsList>
      <TabsContent value="income">{renderPanel('income')}</TabsContent>
      <TabsContent value="payment">{renderPanel('payment')}</TabsContent>
    </Tabs>
  );

  if (compact) return tabs;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
          <Home className="size-5 text-[#820AD1]" /> Qual imóvel cabe no meu bolso?
        </CardTitle>
        <CardDescription>
          Descubra o valor máximo do imóvel sem comprometer demais sua renda.
        </CardDescription>
      </CardHeader>
      <CardContent>{tabs}</CardContent>
    </Card>
  );
}

function PaymentCapacityCards({
  result,
  compact,
  monthlyBudget,
  onUse,
}: {
  result: PaymentAffordabilityResult;
  compact: boolean;
  monthlyBudget: number;
  onUse: (principal: number, system: 'PRICE' | 'SAC', monthlyBudget: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">
        Entrada líquida usada: <strong>{formatBRL(result.availableDownPayment)}</strong>
        {' · '}Custos iniciais reservados: <strong>{formatBRL(result.initialCosts)}</strong>
      </p>
      <div className={compact ? 'flex flex-col gap-3' : 'grid gap-4 lg:grid-cols-2'}>
        {(['PRICE', 'SAC'] as const).map((system) => (
          <section key={system} className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 shadow-sm">
            <h3 className="font-semibold text-primary">{system}</h3>
            {([
              ['initial', 'Máximo pela parcela inicial'],
              ['safe', 'Máximo seguro no contrato'],
            ] as const).map(([key, label]) => {
              const alternative = result.systems[system][key];
              const canTransfer = Boolean(alternative && Number.isFinite(alternative.principal) && alternative.principal > 0);
              return (
                <div key={key} className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-border">
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-lg font-semibold">{alternative ? formatBRL(alternative.principal) : 'Indisponível'}</span>
                  {alternative && result.availableDownPayment > 0 && (
                    <span className="text-xs text-muted-foreground">Imóvel de até {formatBRL(alternative.propertyValue)}</span>
                  )}
                  {alternative && <span className="text-xs text-muted-foreground">
                    Parcela inicial {formatBRL(alternative.initialPayment)} · pico {formatBRL(alternative.peakPayment)} no mês {alternative.peakPaymentMonth}
                  </span>}
                  {!canTransfer && <span className="text-xs text-muted-foreground">Nenhum valor financiável: custos fixos consomem o teto ou o cronograma não quita.</span>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={!canTransfer}
                    onClick={() => alternative && onUse(alternative.principal, system, monthlyBudget)}
                  >
                    <Home className="size-3.5" /> Levar ao simulador
                  </Button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function Field({ label, id, help, children }: { label: string; id: string; help: string; children: React.ReactNode }) {
  return <FieldHelp htmlFor={id} label={label} help={help}>{children}</FieldHelp>;
}
