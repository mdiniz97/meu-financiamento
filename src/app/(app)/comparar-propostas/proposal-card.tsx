'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { RateField } from '@/components/ui/rate-field';
import { FieldHelp } from '@/components/ui/field-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import type { RawFee, RawProposal } from './comparator-client';

export function ProposalCard({
  raw,
  error,
  canRemove,
  onChange,
  onFieldValidityChange,
  onRemove,
}: {
  raw: RawProposal;
  error?: string;
  canRemove: boolean;
  onChange: (patch: Partial<RawProposal>) => void;
  onFieldValidityChange: (field: 'months' | 'annualRate' | 'cetInformed' | 'trMonthly' | 'principal', valid: boolean) => void;
  onRemove: () => void;
}) {
  const updateFee = (feeId: string, patch: Partial<RawFee>) =>
    onChange({ fees: raw.fees.map((x) => (x.id === feeId ? { ...x, ...patch } : x)) });

  const computedPrincipal = parseBRLToNumber(raw.propertyValue) - parseBRLToNumber(raw.downPayment);
  const principalIsManual = raw.principalManual !== '';
  const principalValue = principalIsManual ? parseBRLToNumber(raw.principalManual) : computedPrincipal;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{raw.bank || `Proposta ${raw.id.toUpperCase()}`}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canRemove}
            aria-label={`Remover proposta ${raw.id.toUpperCase()}`}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <FieldHelp htmlFor={`${raw.id}-bank`} label="Banco" help="Nome da instituição que enviou esta proposta; use como aparece no documento para distinguir as ofertas.">
          <Input id={`${raw.id}-bank`} aria-describedby={`${raw.id}-bank-help`} value={raw.bank} onChange={(e) => onChange({ bank: e.target.value })} placeholder="Ex.: Caixa" />
        </FieldHelp>
        <div className="grid grid-cols-2 gap-2">
          <FieldHelp htmlFor={`${raw.id}-prop`} label="Imóvel (R$)" help="Preço total do imóvel usado nesta proposta, antes de descontar a entrada.">
            <MoneyInput id={`${raw.id}-prop`} aria-describedby={`${raw.id}-prop-help`} value={parseBRLToNumber(raw.propertyValue)} onValid={(v) => onChange({ propertyValue: numberToBRLInput(v) })} />
          </FieldHelp>
          <FieldHelp htmlFor={`${raw.id}-entry`} label="Entrada (R$)" help="Valor pago com recursos próprios; ele reduz o saldo financiado e os juros.">
            <MoneyInput id={`${raw.id}-entry`} aria-describedby={`${raw.id}-entry-help`} value={parseBRLToNumber(raw.downPayment)} onValid={(v) => onChange({ downPayment: numberToBRLInput(v) })} />
          </FieldHelp>
        </div>
        <FieldHelp htmlFor={`${raw.id}-principal`} label="Valor financiado (R$)" help="Normalmente é preço menos entrada. Ajuste somente se a proposta incluir ou excluir outro valor.">
          <div className="flex items-center gap-2">
            <MoneyInput
              id={`${raw.id}-principal`}
              aria-describedby={`${raw.id}-principal-help`}
              value={principalValue}
              onValid={(v) => onChange({ principalManual: numberToBRLInput(v) })}
              onValidityChange={(valid) => onFieldValidityChange('principal', valid)}
              className="flex-1"
            />
            {principalIsManual && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Voltar ao automático (imóvel − entrada)"
                onClick={() => onChange({ principalManual: '' })}
              >
                <RotateCcw className="size-3.5" /> automático
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {principalIsManual
              ? `Ajustado manualmente (imóvel − entrada = ${formatBRL(computedPrincipal)})`
              : 'Automático: imóvel − entrada. Edite para ajustar.'}
          </span>
        </FieldHelp>
        <FieldHelp htmlFor={`${raw.id}-system`} label="Sistema" help="SAC amortiza valor fixo e reduz parcelas; PRICE tende a manter parcelas mais estáveis e concentra juros no início.">
          <Select value={raw.system} onValueChange={(v) => onChange({ system: v as 'SAC' | 'PRICE' })}>
            <SelectTrigger id={`${raw.id}-system`} aria-describedby={`${raw.id}-system-help`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SAC">SAC</SelectItem>
              <SelectItem value="PRICE">PRICE</SelectItem>
            </SelectContent>
          </Select>
        </FieldHelp>
        <div className="grid grid-cols-2 gap-2">
          <FieldHelp htmlFor={`${raw.id}-months`} label="Prazo (meses)" help="Total de parcelas da proposta. Prazo maior costuma baixar a parcela e aumentar o custo total.">
            <NumericInput id={`${raw.id}-months`} aria-describedby={`${raw.id}-months-help`} value={Number(raw.months)} parse={parseDecimal} onValid={(v) => onChange({ months: String(v) })} onValidityChange={(valid) => onFieldValidityChange('months', valid)} />
          </FieldHelp>
          <RateField id={`${raw.id}-rate`} label="Taxa contratual" value={raw.annualRate === '' ? undefined : Number(raw.annualRate)} kind={raw.annualRateKind} onValueChange={(v) => onChange({ annualRate: String(v) })} onKindChange={(annualRateKind) => onChange({ annualRateKind })} onValidityChange={(valid) => onFieldValidityChange('annualRate', valid)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldHelp htmlFor={`${raw.id}-cet`} label="CET efetivo anual informado (%)" help="Copie o Custo Efetivo Total anual da proposta. Ele inclui juros e encargos e serve para auditar o custo informado pelo banco.">
            <NumericInput id={`${raw.id}-cet`} aria-describedby={`${raw.id}-cet-help`} value={raw.cetInformed === '' ? undefined : Number(raw.cetInformed)} parse={parseDecimal} onValid={(v) => onChange({ cetInformed: String(v) })} onValidityChange={(valid) => onFieldValidityChange('cetInformed', valid)} />
          </FieldHelp>
          <FieldHelp htmlFor={`${raw.id}-tr`} label="TR mensal (%)" help="Correção monetária mensal separada dos juros. Use a taxa indicada na proposta ou zero se o contrato não aplicar TR.">
            <NumericInput id={`${raw.id}-tr`} aria-describedby={`${raw.id}-tr-help`} value={Number(raw.trMonthly)} parse={parseDecimal} onValid={(v) => onChange({ trMonthly: String(v) })} onValidityChange={(valid) => onFieldValidityChange('trMonthly', valid)} />
          </FieldHelp>
        </div>
        <FieldHelp htmlFor={`${raw.id}-insurance`} label="Seguro (R$/mês)" help="Soma mensal dos seguros da proposta. Esse custo entra nas parcelas simuladas.">
          <MoneyInput id={`${raw.id}-insurance`} aria-describedby={`${raw.id}-insurance-help`} value={parseBRLToNumber(raw.insuranceMonthly)} onValid={(v) => onChange({ insuranceMonthly: numberToBRLInput(v) })} />
        </FieldHelp>
        <FieldHelp group htmlFor={`${raw.id}-fees`} label="Tarifas" help="Liste nome e valor das cobranças da proposta. Marque no CET quando a tarifa já estiver incluída no custo efetivo informado.">
          {raw.fees.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input
                id={`${raw.id}-${f.id}-fee-label`}
                value={f.label}
                onChange={(e) => updateFee(f.id, { label: e.target.value })}
                className="h-8"
                aria-label="Nome da tarifa"
                data-field-help-id={`${raw.id}-fees`}
                aria-describedby={`${raw.id}-fees-help`}
              />
              <MoneyInput id={`${raw.id}-${f.id}-fee-amount`} data-field-help-id={`${raw.id}-fees`} aria-label="Valor da tarifa" aria-describedby={`${raw.id}-fees-help`} value={parseBRLToNumber(f.amount)} onValid={(v) => updateFee(f.id, { amount: numberToBRLInput(v) })} />
              <label className="flex shrink-0 items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  id={`${raw.id}-${f.id}-fee-cet`}
                  aria-label="Incluir tarifa no CET"
                  data-field-help-id={`${raw.id}-fees`}
                  aria-describedby={`${raw.id}-fees-help`}
                  checked={f.includeInCet}
                  onChange={(e) => updateFee(f.id, { includeInCet: e.target.checked })}
                />
                no CET
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ fees: raw.fees.filter((x) => x.id !== f.id) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => onChange({ fees: [...raw.fees, { id: `f${Date.now()}`, label: 'Tarifa', amount: '0', includeInCet: false }] })}
          >
            <Plus className="size-3.5" /> Adicionar tarifa
          </Button>
        </FieldHelp>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
