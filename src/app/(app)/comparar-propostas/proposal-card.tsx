'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import type { RawFee, RawProposal } from './comparator-client';

export function ProposalCard({
  raw,
  error,
  canRemove,
  onChange,
  onRemove,
}: {
  raw: RawProposal;
  error?: string;
  canRemove: boolean;
  onChange: (patch: Partial<RawProposal>) => void;
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-bank`}>Banco</Label>
          <Input id={`${raw.id}-bank`} value={raw.bank} onChange={(e) => onChange({ bank: e.target.value })} placeholder="Ex.: Caixa" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-prop`}>Imóvel (R$)</Label>
            <MoneyInput id={`${raw.id}-prop`} value={parseBRLToNumber(raw.propertyValue)} onValid={(v) => onChange({ propertyValue: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-entry`}>Entrada (R$)</Label>
            <MoneyInput id={`${raw.id}-entry`} value={parseBRLToNumber(raw.downPayment)} onValid={(v) => onChange({ downPayment: String(v) })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-principal`}>Valor financiado (R$)</Label>
          <div className="flex items-center gap-2">
            <MoneyInput
              id={`${raw.id}-principal`}
              value={principalValue}
              onValid={(v) => onChange({ principalManual: String(v) })}
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-system`}>Sistema</Label>
          <Select value={raw.system} onValueChange={(v) => onChange({ system: v as 'SAC' | 'PRICE' })}>
            <SelectTrigger id={`${raw.id}-system`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SAC">SAC</SelectItem>
              <SelectItem value="PRICE">PRICE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-months`}>Prazo (meses)</Label>
            <NumericInput id={`${raw.id}-months`} value={Number(raw.months)} parse={parseDecimal} onValid={(v) => onChange({ months: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-rate`}>Taxa a.a. (%)</Label>
            <NumericInput id={`${raw.id}-rate`} value={raw.annualRate === '' ? undefined : Number(raw.annualRate)} parse={parseDecimal} onValid={(v) => onChange({ annualRate: String(v) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-cet`}>CET informado a.a. (%)</Label>
            <NumericInput id={`${raw.id}-cet`} value={raw.cetInformed === '' ? undefined : Number(raw.cetInformed)} parse={parseDecimal} onValid={(v) => onChange({ cetInformed: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-tr`}>TR mensal (%)</Label>
            <NumericInput id={`${raw.id}-tr`} value={Number(raw.trMonthly)} parse={parseDecimal} onValid={(v) => onChange({ trMonthly: String(v) })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-insurance`}>Seguro (R$/mês)</Label>
          <MoneyInput id={`${raw.id}-insurance`} value={parseBRLToNumber(raw.insuranceMonthly)} onValid={(v) => onChange({ insuranceMonthly: String(v) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tarifas</span>
          {raw.fees.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input
                value={f.label}
                onChange={(e) => updateFee(f.id, { label: e.target.value })}
                className="h-8"
                aria-label="Nome da tarifa"
              />
              <MoneyInput value={parseBRLToNumber(f.amount)} onValid={(v) => updateFee(f.id, { amount: String(v) })} />
              <label className="flex shrink-0 items-center gap-1 text-xs">
                <input
                  type="checkbox"
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
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
