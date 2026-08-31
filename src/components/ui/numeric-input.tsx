'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

type InputProps = ComponentProps<typeof Input>;

/**
 * Input numérico que aceita vírgula PT-BR, permite apagar tudo e nunca propaga
 * texto inválido (letras etc.): só emite valores numéricos válidos.
 */
export function NumericInput({
  value,
  onValid,
  onValidityChange,
  parse,
  className,
  ...props
}: {
  value: number | undefined;
  onValid: (v: number) => void;
  onValidityChange?: (valid: boolean) => void;
  parse: (s: string) => number;
} & Omit<InputProps, 'value' | 'onChange'>) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const controlledText = value != null ? String(value) : '';
  const displayed = focused ? text : controlledText;

  return (
    <Input
      {...props}
      inputMode="decimal"
      className={className}
      value={displayed}
      onFocus={(e) => {
        setText(e.target.value);
        setFocused(true);
        onValidityChange?.(e.target.value.trim() === '' || Number.isFinite(parse(e.target.value)));
      }}
      onBlur={() => {
        setFocused(false);
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value.trim() === '') {
          // apagou tudo: emite 0 para o campo não voltar ao valor antigo no blur
          onValidityChange?.(true);
          onValid(0);
          return;
        }
        const v = parse(e.target.value);
        const valid = Number.isFinite(v);
        onValidityChange?.(valid);
        if (valid) onValid(v);
      }}
    />
  );
}

/** aceita apenas dígitos (para mês, intervalo etc.) */
export const parseIntStrict = (s: string) => {
  const value = s.trim();
  return /^\d+$/.test(value) ? Number(value) : NaN;
};
