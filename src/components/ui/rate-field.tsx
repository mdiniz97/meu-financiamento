'use client';

import { useState } from 'react';
import { FieldHelp } from '@/components/ui/field-help';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isRateKind, normalizeRate, type RateKind } from '@/lib/finance/rates';
import { parseDecimal } from '@/lib/utils';

const RATE_KINDS: Array<{ value: RateKind; label: string }> = [
  { value: 'effective-annual', label: 'Efetiva a.a.' },
  { value: 'nominal-annual', label: 'Nominal a.a.' },
  { value: 'effective-monthly', label: 'Efetiva a.m.' },
];

const RATE_KIND_LABELS = Object.fromEntries(RATE_KINDS.map((option) => [option.value, option.label])) as Record<RateKind, string>;

export function RateField({
  id,
  value,
  kind,
  onValueChange,
  onKindChange,
  onValidityChange,
  label,
  minEffectiveAnnual = Number.EPSILON,
  maxEffectiveAnnual = 1,
}: {
  id: string;
  value: number | undefined;
  kind: RateKind;
  onValueChange: (value: number) => void;
  onKindChange: (kind: RateKind) => void;
  onValidityChange?: (valid: boolean) => void;
  label: string;
  minEffectiveAnnual?: number;
  maxEffectiveAnnual?: number;
}) {
  const [syntaxValid, setSyntaxValid] = useState(true);
  let equivalent: string | null = null;
  let domainError: string | null = null;
  try {
    if (value !== undefined) {
      const normalized = normalizeRate(value, kind);
      if (normalized.effectiveAnnual < minEffectiveAnnual) {
        domainError = minEffectiveAnnual === 0 ? 'Informe uma taxa válida.' : 'Informe uma taxa maior que zero.';
      } else if (normalized.effectiveAnnual > maxEffectiveAnnual) {
        domainError = `A taxa deve equivaler a no máximo ${(maxEffectiveAnnual * 100).toFixed(0)}% a.a.`;
      } else {
        equivalent = `Equivale a ${(normalized.effectiveAnnual * 100).toFixed(2)}% a.a. efetivos e ${(normalized.effectiveMonthly * 100).toFixed(4)}% a.m.`;
      }
    }
  } catch {
    domainError = 'Informe uma taxa válida.';
  }
  const error = !syntaxValid ? 'Informe uma taxa válida.' : domainError;

  function isValidRate(nextValue: number | undefined, nextKind: RateKind) {
    if (nextValue === undefined) return false;
    let valid = false;
    try {
      const normalized = normalizeRate(nextValue, nextKind).effectiveAnnual;
      valid = normalized >= minEffectiveAnnual && normalized <= maxEffectiveAnnual;
    } catch {
      // Valor fora do domínio permanece editável.
    }
    return valid;
  }

  function reportValue(nextValue: number) {
    const valid = isValidRate(nextValue, kind);
    onValidityChange?.(valid);
    onValueChange(nextValue);
  }

  return (
    <FieldHelp
      htmlFor={id}
      label={label}
      help="Copie a taxa e o tipo indicados no contrato ou proposta. Efetiva inclui capitalização; nominal anual corresponde à taxa mensal multiplicada por 12. O tipo muda a taxa usada no cálculo."
    >
      <div className="flex gap-2">
        <NumericInput
          id={id}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          aria-invalid={error ? true : undefined}
          value={value}
          parse={parseDecimal}
          onValid={reportValue}
          onValidityChange={(valid) => {
            setSyntaxValid(valid);
            onValidityChange?.(valid && isValidRate(value, kind));
          }}
          className="min-w-0 flex-1"
        />
        <Select
          value={kind}
          onValueChange={(nextKind) => {
            if (!isRateKind(nextKind)) return;
            if (!syntaxValid) {
              onValidityChange?.(false);
            } else {
              onValidityChange?.(isValidRate(value, nextKind));
            }
            onKindChange(nextKind);
          }}
        >
          <SelectTrigger data-field-help-id={id} aria-label={`Tipo de ${label}`} aria-describedby={`${id}-help`} className="w-32" size="sm">
            <SelectValue>{RATE_KIND_LABELS[kind]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RATE_KINDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {equivalent && <p className="text-xs text-muted-foreground">{equivalent}</p>}
    </FieldHelp>
  );
}
