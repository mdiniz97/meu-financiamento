'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { formatBRL } from '@/lib/utils';

/**
 * Campo de dinheiro estilo transferência bancária: mostra o valor formatado
 * (R$ 1.000,00), e ao digitar os números vão entrando da direita (digita "1"
 * → 0,01; "12" → 0,12; "123" → 1,23...). Só aceita dígitos.
 */
export function MoneyInput({
  value,
  onValid,
  className,
  ...props
}: {
  value: number;
  onValid: (v: number) => void;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [digits, setDigits] = useState('');
  const [focused, setFocused] = useState(false);

  const fmt = (d: string) => {
    const cents = (d || '0').padStart(3, '0');
    const reais = cents.slice(0, -2);
    const c = cents.slice(-2);
    return `${Number(reais).toLocaleString('pt-BR')},${c}`;
  };

  return (
    <Input
      {...props}
      inputMode="numeric"
      className={className}
      value={focused ? fmt(digits) : formatBRL(value)}
      onFocus={() => {
        setDigits(String(Math.round(value * 100)));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const d = e.target.value.replace(/[^\d]/g, '');
        if (d.length > 13) return;
        setDigits(d);
        onValid(Number(d) / 100);
      }}
    />
  );
}
