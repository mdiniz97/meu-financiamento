'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Sparkles, Lock } from 'lucide-react';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import { BANKS } from '@/lib/simulation-context';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { normalizeRate, type RateKind } from '@/lib/finance/rates';
import type { AmortSystem } from '@/lib/finance/types';
import { numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AffordabilityCalculator } from './AffordabilityCalculator';

export interface SmartCalcFields {
  preferredSystem: AmortSystem | 'AUTO';
  principal: string;
  annualRate: string;
  annualRateKind: RateKind;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  maxMonths: string;
  maxPayment: string;
  fixedUntilMonth: string;
}

export const SMART_DEFAULTS: SmartCalcFields = {
  preferredSystem: 'AUTO',
  principal: '1000000',
  annualRate: '10.5',
  annualRateKind: 'effective-annual',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  maxMonths: '360',
  maxPayment: '12000',
  fixedUntilMonth: '',
};

function effectiveAnnualPercent(value: string, kind: RateKind) {
  try {
    return normalizeRate(parseDecimal(value), kind).effectiveAnnual * 100;
  } catch {
    return 0;
  }
}

interface Props {
  isUnlimited: boolean;
  onCalculated: (rec: SmartRecommendation, fields: SmartCalcFields) => void;
  onValidationFailed?: () => void;
}

export function SmartCalculator({ isUnlimited, onCalculated, onValidationFailed }: Props) {
  const search = useSearchParams();
  // prefill vindo da portabilidade: /nova-simulacao?principal=&taxa=&prazo=
  const [f, setF] = useState<SmartCalcFields>(() => {
    const principal = search.get('principal');
    const taxa = search.get('taxa');
    const prazo = search.get('prazo');
    if (!principal && !taxa && !prazo) return SMART_DEFAULTS;
    return {
      ...SMART_DEFAULTS,
      principal: principal ?? SMART_DEFAULTS.principal,
      annualRate: taxa ?? SMART_DEFAULTS.annualRate,
      maxMonths: prazo ?? SMART_DEFAULTS.maxMonths,
    };
  });
  const [error, setError] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [annualRateValid, setAnnualRateValid] = useState(true);

  const set = <K extends keyof SmartCalcFields>(k: K, v: SmartCalcFields[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function calcular() {
    setError('');
    onValidationFailed?.();
    if (!annualRateValid) {
      return setError('Informe uma taxa válida.');
    }
    const principal = parseBRLToNumber(f.principal);
    const annualRate = parseDecimal(f.annualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const maxMonths = Number(f.maxMonths);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    const until = Number(f.fixedUntilMonth);
    let effectiveAnnualRate = NaN;
    try {
      effectiveAnnualRate = normalizeRate(annualRate, f.annualRateKind).effectiveAnnual;
    } catch {
      // Validação abaixo apresenta erro no formulário.
    }
    if (!(principal > 0)) return setError('Informe o valor financiado (maior que zero).');
    if (!(effectiveAnnualRate >= 0 && effectiveAnnualRate <= 1)) return setError('Informe uma taxa válida.');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro mensal válido.');
    if (!(maxMonths >= 60 && maxMonths <= 600)) return setError('Prazo máximo deve estar entre 60 e 600 meses.');
    if (!(maxPayment > 0)) return setError('Informe quanto pode pagar por mês.');

    const rec = recommendSmart({
      principal,
      annualRate: effectiveAnnualRate,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      bank: f.bank,
      maxMonths,
      maxPayment,
      fixedUntilMonth:
        Number.isInteger(until) && until >= 1 ? Math.min(until, maxMonths) : undefined,
      preferredSystem: f.preferredSystem === 'AUTO' ? undefined : f.preferredSystem,
    });
    onCalculated(rec, f);
  }

  return (
    <Card className="flex h-full w-full flex-col rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Cálculo inteligente <Sparkles className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e estratégia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!isUnlimited ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <Lock className="mx-auto size-8 text-[#820AD1]" />
            <p className="text-sm font-medium">Recurso exclusivo do plano Ilimitado</p>
            <p className="text-sm text-muted-foreground">
              Cálculo inteligente: descubra o melhor modelo e prazo pelo seu orçamento.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mx-auto"
              onClick={() => setUpgradeOpen(true)}
            >
              <Lock className="size-3" /> Ver opções de acesso
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                <Search className="size-3.5" /> Descobrir quanto posso financiar
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
               <FieldHelp htmlFor="smartPreferredSystem" label="Sistema preferido" help="Use Automático para comparar PRICE e SAC, ou preserve o sistema escolhido no cálculo de capacidade.">
                 <Select value={f.preferredSystem} onValueChange={(value) => {
                   if (value === 'AUTO' || value === 'PRICE' || value === 'SAC') set('preferredSystem', value);
                 }}>
                   <SelectTrigger id="smartPreferredSystem" aria-label="Sistema preferido" aria-describedby="smartPreferredSystem-help" className="w-full"><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="AUTO">Automático</SelectItem>
                     <SelectItem value="PRICE">PRICE</SelectItem>
                     <SelectItem value="SAC">SAC</SelectItem>
                   </SelectContent>
                 </Select>
               </FieldHelp>
               <FieldHelp htmlFor="smartPrincipal" label="Valor financiado (R$)" help="Valor que você precisa financiar. O cálculo testa sistemas e prazos para essa dívida.">
                 <MoneyInput
                 id="smartPrincipal"
                 aria-label="Valor financiado (R$)"
                 aria-describedby="smartPrincipal-help"
                value={parseBRLToNumber(f.principal)}
                 onValid={(v) => set("principal", numberToBRLInput(v))}
              />
               </FieldHelp>
              <RateField id="smartRate" label="Taxa de juros" value={parseDecimal(f.annualRate)} kind={f.annualRateKind} minEffectiveAnnual={0} onValueChange={(v) => set('annualRate', String(v))} onKindChange={(kind) => set('annualRateKind', kind)} onValidityChange={setAnnualRateValid} />
               <FieldHelp htmlFor="smartTr" label="TR mensal (%)" help="Correção mensal além dos juros. Informe a TR indicada pelo banco para comparar parcelas futuras.">
                <NumericInput
                 id="smartTr"
                 aria-label="TR mensal (%)"
                 aria-describedby="smartTr-help"
                value={parseDecimal(f.trMonthly)}
                parse={parseDecimal}
                onValid={(v) => set("trMonthly", String(v))}
              />
               </FieldHelp>
               <FieldHelp htmlFor="smartSeguro" label="Seguro (R$/mês)" help="Custo mensal dos seguros somado à parcela e ao limite que você pode pagar.">
                <MoneyInput
                 id="smartSeguro"
                 aria-label="Seguro (R$/mês)"
                 aria-describedby="smartSeguro-help"
                value={parseBRLToNumber(f.insuranceMonthly)}
                 onValid={(v) => set("insuranceMonthly", numberToBRLInput(v))}
              />
               </FieldHelp>
               <FieldHelp htmlFor="smartBank" label="Banco" help="Banco usado para identificar a simulação recomendada e o relatório.">
                <Select value={f.bank} onValueChange={(v) => set('bank', String(v))}>
                   <SelectTrigger id="smartBank" aria-label="Banco" aria-describedby="smartBank-help" className="w-full">
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
               <FieldHelp htmlFor="smartMaxMonths" label="Prazo máximo (meses)" help="Maior prazo que você aceita. O cálculo pode recomendar prazo menor quando couber no orçamento.">
                <NumericInput
                 id="smartMaxMonths"
                 aria-describedby="smartMaxMonths-help"
                value={Number(f.maxMonths)}
                parse={parseIntStrict}
                onValid={(v) => set("maxMonths", String(v))}
              />
               </FieldHelp>
               <FieldHelp htmlFor="smartMaxPayment2" label="Quanto pode pagar por mês (R$)" help="Teto mensal para parcela e aporte automático juntos; valor maior pode encurtar o contrato.">
                <MoneyInput
                   id="smartMaxPayment2"
                   aria-describedby="smartMaxPayment2-help"
                  value={parseBRLToNumber(f.maxPayment)}
                   onValid={(v) => set("maxPayment", numberToBRLInput(v))}
                />
                <p className="text-xs text-muted-foreground">
                  Parcela + aporte automático = sempre esse valor, até quitar.
                </p>
               </FieldHelp>
               <FieldHelp htmlFor="smartFixedUntil" label="Pagar esse valor por um período (opcional)" help="Último mês em que você consegue pagar o teto completo; depois disso fica somente a parcela contratual.">
                <NumericInput
                   id="smartFixedUntil"
                   aria-describedby="smartFixedUntil-help"
                  value={f.fixedUntilMonth ? Number(f.fixedUntilMonth) : undefined}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) => set('fixedUntilMonth', v > 0 ? String(v) : '')}
                />
                <p className="text-xs text-muted-foreground">
                  Até o mês informado você paga o valor cheio; depois, volta a pagar apenas a
                  parcela do contrato.
                </p>
               </FieldHelp>
            </div>

            <div className="mt-auto flex justify-end">
              <Button type="button" onClick={calcular}>
                <Sparkles className="size-4" /> Calcular melhor modelo
              </Button>
            </div>


            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Qual imóvel cabe no meu bolso?</DialogTitle>
            <DialogDescription>
              Considere renda, entrada, custos iniciais e condições do financiamento.
            </DialogDescription>
          </DialogHeader>
          <AffordabilityCalculator
            compact
            defaults={{
              paymentCap: parseBRLToNumber(f.maxPayment),
              annualRate: effectiveAnnualPercent(f.annualRate, f.annualRateKind),
              annualRateKind: 'effective-annual',
              trMonthly: parseDecimal(f.trMonthly),
              insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
              bank: f.bank,
              months: Number(f.maxMonths),
            }}
            onUse={(selection) => {
              set('preferredSystem', selection.system);
              set('principal', numberToBRLInput(selection.principal));
              set('maxPayment', numberToBRLInput(selection.monthlyBudget));
              set('annualRate', String(selection.annualRate));
              set('annualRateKind', selection.annualRateKind);
              setAnnualRateValid(true);
              set('trMonthly', String(selection.trMonthly));
              set('insuranceMonthly', numberToBRLInput(selection.insuranceMonthly));
              set('bank', selection.bank);
              set('maxMonths', String(selection.months));
              setModalOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </Card>
  );
}
