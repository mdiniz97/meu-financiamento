'use client';

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type ChangeEvent,
  type ComponentProps,
  type CompositionEvent,
  type FocusEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { Input } from '@/components/ui/input';
import { formatBRL } from '@/lib/utils';

export function isMoneyValueWithinDigitLimit(value: number, maxDigits: number): boolean {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(maxDigits) || maxDigits < 1) return false;
  const digits = value > 0 ? String(Math.round(value * 100)) : '';
  return digits.length <= maxDigits;
}

/**
 * Campo de dinheiro estilo transferência bancária: mostra o valor formatado
 * (R$ 1.000,00), e ao digitar os números vão entrando da direita (digita "1"
 * → 0,01; "12" → 0,12; "123" → 1,23...). Só aceita dígitos.
 */
export function MoneyInput({
  value,
  onValid,
  className,
  onFocus,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  onValidityChange,
  maxDigits = 13,
  ...props
}: {
  value: number;
  onValid: (v: number) => void;
  onValidityChange?: (valid: boolean) => void;
  maxDigits?: number;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const valueDigits = value > 0 ? String(Math.round(value * 100)) : '';
  const controlledValueValid = isMoneyValueWithinDigitLimit(value, maxDigits);
  const [digits, setDigits] = useState(valueDigits);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const composingRef = useRef(false);
  const notifyValidity = useEffectEvent((valid: boolean) => onValidityChange?.(valid));
  const limitMessageId = `${useId()}-digit-limit`;
  const describedBy = [props['aria-describedby'], limitMessageId].filter(Boolean).join(' ');

  useEffect(() => {
    composingRef.current = false;
    // Controlled value changes must replace any in-progress local editing buffer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComposing(false);
    setDigits(valueDigits);
    setLimitExceeded(!controlledValueValid);
    notifyValidity(controlledValueValid);
  }, [value, valueDigits, maxDigits, controlledValueValid]);

  function restoreValidBuffer() {
    if (!limitExceeded) return;
    setLimitExceeded(!controlledValueValid);
    onValidityChange?.(controlledValueValid);
  }

  const fmt = (d: string) => {
    const cents = (d || '0').padStart(3, '0');
    const reais = cents.slice(0, -2);
    const c = cents.slice(-2);
    return `${Number(reais).toLocaleString('pt-BR')},${c}`;
  };

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    flushSync(() => {
      setDigits(valueDigits);
      setFocused(true);
      restoreValidBuffer();
    });
    input.select();
    onFocus?.(event);
  }

  function handleChange(raw: string) {
    const next = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (next.length > maxDigits) {
      setLimitExceeded(true);
      onValidityChange?.(false);
      return;
    }
    const nextValue = next ? Number(next) / 100 : 0;
    setLimitExceeded(false);
    onValidityChange?.(true);
    setDigits(next);
    onValid(nextValue);
  }

  function rejectOversizePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');
    const input = event.currentTarget;
    const selected = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0).replace(/\D/g, '').length;
    if (digits.length - selected + pastedDigits.length <= maxDigits) return;
    event.preventDefault();
    setLimitExceeded(true);
    onValidityChange?.(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (composingRef.current || (event.nativeEvent as InputEvent).isComposing) {
      setDigits(event.target.value);
      return;
    }
    handleChange(event.target.value);
  }

  function handleCompositionStart(event: CompositionEvent<HTMLInputElement>) {
    composingRef.current = true;
    setComposing(true);
    onCompositionStart?.(event);
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    setComposing(false);
    handleChange(event.currentTarget.value);
    onCompositionEnd?.(event);
  }

  return (
    <div className="contents">
      <Input
      {...props}
      aria-describedby={describedBy}
      aria-invalid={limitExceeded || props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      inputMode="numeric"
      className={className}
      value={focused ? (composing ? digits : fmt(digits)) : formatBRL(value)}
      onFocus={handleFocus}
      onBlur={(event) => {
        setFocused(false);
        restoreValidBuffer();
        onBlur?.(event);
      }}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={rejectOversizePaste}
      onChange={handleInputChange}
      />
      <span id={limitMessageId} role="alert" className="sr-only">
        {limitExceeded ? `Limite de ${maxDigits} dígitos. O último valor válido foi mantido.` : ''}
      </span>
    </div>
  );
}
