'use client';
import { useState, type ComponentProps } from 'react';
import { MoneyInput as BaseMoneyInput } from '@/components/ui/money-input';
import { NumericInput as BaseNumericInput } from '@/components/ui/numeric-input';
import { RateField as BaseRateField } from '@/components/ui/rate-field';
export { parseIntStrict } from '@/components/ui/numeric-input';

export function MoneyInput(props: ComponentProps<typeof BaseMoneyInput>) {
  const [edited, setEdited] = useState(false);
  return <BaseMoneyInput {...props} emptyWhenZero={!edited} onValid={value => {
    setEdited(true);
    props.onValid(value);
  }} />;
}
export function NumericInput({ value, ...props }: ComponentProps<typeof BaseNumericInput>) {
  const [edited, setEdited] = useState(false);
  return <BaseNumericInput {...props} value={Number.isFinite(value) && (edited || value !== 0) ? value : undefined} onValid={next => {
    setEdited(true);
    props.onValid(next);
  }} />;
}
export function RateField({ value, ...props }: ComponentProps<typeof BaseRateField>) {
  const [edited, setEdited] = useState(false);
  return <BaseRateField {...props} value={Number.isFinite(value) && (edited || value !== 0) ? value : undefined} onValueChange={next => {
    setEdited(true);
    props.onValueChange(next);
  }} />;
}
