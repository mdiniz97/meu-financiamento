'use client';
import { type ComponentProps } from 'react';
import { MoneyInput as BaseMoneyInput } from '@/components/ui/money-input';
import { NumericInput as BaseNumericInput } from '@/components/ui/numeric-input';
import { RateField as BaseRateField } from '@/components/ui/rate-field';
export { parseIntStrict } from '@/components/ui/numeric-input';

/** New simulation forms start with zero shown (R$ 0,00 / 0), never example values. */
export function MoneyInput(props: ComponentProps<typeof BaseMoneyInput>) {
  return <BaseMoneyInput {...props} value={Number.isFinite(props.value) ? props.value : 0} />;
}
export function NumericInput({ value, ...props }: ComponentProps<typeof BaseNumericInput>) {
  return <BaseNumericInput {...props} value={Number.isFinite(value) ? value : 0} />;
}
export function RateField({ value, ...props }: ComponentProps<typeof BaseRateField>) {
  return <BaseRateField {...props} value={Number.isFinite(value) ? value : 0} />;
}
