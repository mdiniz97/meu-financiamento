'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

type InputProps = ComponentProps<typeof Input>;

/**
 * Input numérico que aceita vírgula PT-BR, permite apagar tudo e nunca propaga
 * texto inválido (letras etc.) — só emite valores numéricos válidos.
 */
export function NumericInput({
  value,
  onValid,
  parse,
  className,
  ...props
}: {
  value: number | undefined;
  onValid: (v: number) => void;
  parse: (s: string) => number;
} & Omit<InputProps, 'value' | 'onChange'>) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const displayed = focused ? text : value != null ? String(value) : '';

  return (
    <Input
      {...props}
      inputMode="decimal"
      className={className}
      value={displayed}
      onFocus={(e) => {
        setText(e.target.value);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const v = parse(e.target.value);
        if (Number.isFinite(v)) onValid(v);
      }}
    />
  );
}

/** aceita apenas dígitos (para mês, intervalo etc.) */
export const parseIntStrict = (s: string) => {
  const digits = s.replace(/[^\d]/g, '');
  return digits === '' ? NaN : Number(digits);
};
