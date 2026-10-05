'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { loginHref } from '@/lib/login-redirect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput, NumericInput, parseIntStrict, RateField } from './form-inputs';
import { evaluateNegotiation, type NegotiationResult } from '@/lib/finance/negotiation';
import type { AmortSystem } from '@/lib/finance/types';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';
import { listNegotiations, type SavedNegotiation } from '@/app/negociacao/actions';

interface Form {
  system: AmortSystem;
  principal: string;
  propertyValue: string;
  annualRate: string;
  months: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  maxPayment: string;
}

const DEFAULTS: Form = {
  system: 'PRICE',
  principal: '',
  propertyValue: '',
  annualRate: '',
  months: '',
  trMonthly: '',
  insuranceMonthly: '',
  bank: '',
  maxPayment: '',
};

const fmtRate = (rate: number) =>
  `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.`;

export function NegotiationCalculator({ signedIn = false }: { signedIn?: boolean }) {
  const [f, setF] = useState<Form>(DEFAULTS);
  const [rateValid, setRateValid] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [saved, setSaved] = useState<SavedNegotiation[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const refresh = useCallback(async () => setSaved(await listNegotiations()), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState ocorre após await
    void refresh();
  }, [refresh]);

  const { result, error } = useMemo<{ result: NegotiationResult | null; error: string }>(() => {
    const principal = parseBRLToNumber(f.principal);
    const propertyValue = parseBRLToNumber(f.propertyValue);
    const months = Number(f.months);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    const ready =
      principal > 0 &&
      propertyValue > 0 &&
      months >= 1 &&
      maxPayment > 0 &&
      f.annualRate.trim() !== '' &&
      rateValid &&
      f.bank !== '';
    if (!ready) return { result: null, error: '' };
    try {
      return {
        result: evaluateNegotiation({
          system: f.system,
          principal,
          propertyValue,
          annualRate: parseDecimal(f.annualRate) / 100,
          months,
          trMonthly: parseDecimal(f.trMonthly) / 100,
          insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
          bank: f.bank,
          maxPayment,
        }),
        error: '',
      };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Dados inválidos.' };
    }
  }, [f, rateValid]);

  async function save() {
    if (!result) return;
    setSaveMsg('');
    const res = await saveToolSimulation({
      name: f.bank ? `Negociação ${f.bank}` : 'Negociação',
      system: 'negociacao',
      payload: f,
      result,
      charge: false,
    });
    if ('error' in res) {
      setSaveMsg(res.error);
      return;
    }
    setSaveMsg('Oferta salva.');
    await refresh();
  }

  const teto = parseBRLToNumber(f.maxPayment);

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <FieldHelp htmlFor="ngPrincipal" label="Valor financiado (R$)" help="Quanto o banco empresta (preço do imóvel menos a entrada).">
            <MoneyInput id="ngPrincipal" value={parseBRLToNumber(f.principal)} onValid={(v) => set('principal', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngProperty" label="Valor do imóvel (R$)" help="Preço total do imóvel; usado para a entrada mínima.">
            <MoneyInput id="ngProperty" value={parseBRLToNumber(f.propertyValue)} onValid={(v) => set('propertyValue', numberToBRLInput(v))} />
          </FieldHelp>
          <RateField
            id="ngRate"
            label="Taxa de juros"
            value={parseDecimal(f.annualRate)}
            kind="effective-annual"
            minEffectiveAnnual={0}
            onValueChange={(v) => set('annualRate', String(v))}
            onValidityChange={setRateValid}
            onKindChange={() => undefined}
          />
          <FieldHelp htmlFor="ngMonths" label="Prazo (meses)" help="Número de parcelas da proposta.">
            <NumericInput id="ngMonths" value={Number(f.months)} parse={parseIntStrict} onValid={(v) => set('months', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngTr" label="TR mensal (%)" help="Correção monetária mensal; use 0 se não houver.">
            <NumericInput id="ngTr" value={parseDecimal(f.trMonthly)} parse={parseDecimal} onValid={(v) => set('trMonthly', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngIns" label="Seguro (R$/mês)" help="Seguro mensal (MIP+DFI) informado pelo banco.">
            <MoneyInput id="ngIns" value={parseBRLToNumber(f.insuranceMonthly)} onValid={(v) => set('insuranceMonthly', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngBank" label="Banco" help="Instituição da proposta.">
            <Select value={f.bank} onValueChange={(b) => set('bank', String(b))}>
              <SelectTrigger id="ngBank" className="w-full" size="sm">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldHelp>
          <FieldHelp htmlFor="ngTeto" label="Quanto posso pagar por mês (R$)" help="O máximo que cabe no seu bolso por mês (parcela + seguro).">
            <MoneyInput id="ngTeto" value={parseBRLToNumber(f.maxPayment)} onValid={(v) => set('maxPayment', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngSystem" label="Sistema" help="PRICE mantém a parcela estável; SAC começa maior e cai.">
            <RadioGroup id="ngSystem" aria-label="Sistema" value={f.system} onValueChange={(s) => set('system', s as AmortSystem)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="PRICE" /> PRICE</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="SAC" /> SAC</label>
            </RadioGroup>
          </FieldHelp>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              {result.fits
                ? (result.slackMonthly < 50 ? 'Cabe, mas fica apertado' : 'Cabe no seu orçamento')
                : 'Não cabe com esse valor por mês'}
            </CardTitle>
            <CardDescription>
              {result.fits
                ? `A primeira parcela é ${formatBRL(result.initialPayment)} e você quer pagar até ${formatBRL(teto)} por mês.`
                : `A primeira parcela seria ${formatBRL(result.initialPayment)}, acima do que você quer pagar (${formatBRL(teto)} por mês).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div>
              <p className="font-semibold">
                {result.fits
                  ? 'Para manter dentro do seu orçamento, peça ao banco:'
                  : 'Para caber no seu orçamento, o banco precisaria oferecer:'}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                <li className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>
                    {result.maxAnnualRate !== null
                      ? <>Juros de até <strong>{fmtRate(result.maxAnnualRate)}</strong></>
                      : 'Não há taxa de juros que resolva: é preciso financiar menos ou dar uma entrada maior.'}
                  </span>
                </li>
                {result.minDownPayment > 0 && (
                  <li className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>Uma entrada de pelo menos <strong>{formatBRL(result.minDownPayment)}</strong></span>
                  </li>
                )}
                <li className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>Pagar em pelo menos <strong>{result.minMonths} {result.minMonths === 1 ? 'mês' : 'meses'}</strong> (em menos meses, a parcela passa do seu limite)</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>Financiar no máximo <strong>{formatBRL(result.maxPrincipal)}</strong> — ou seja, um imóvel de até <strong>{formatBRL(result.maxPropertyValue)}</strong> com a entrada de hoje</span>
                </li>
              </ul>
            </div>
            {result.peakPayment > teto + 0.01 && (
              <p className="text-xs text-muted-foreground">
                Atenção: essa parcela aumenta com o tempo (a TR reajusta o valor) e pode chegar a {formatBRL(result.peakPayment)} no fim do contrato.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {signedIn ? (
                <Button type="button" onClick={save}>Salvar oferta</Button>
              ) : (
                <Button variant="outline" nativeButton={false} render={<Link href={loginHref('/negociacao')} />}>
                  Entre para salvar
                </Button>
              )}
              {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {signedIn && saved.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ofertas salvas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {saved.map((s) => {
              const payload = (s.payload ?? {}) as Partial<Form>;
              return (
                <div key={s.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-mono tabular-nums">{formatBRL(parseBRLToNumber(payload.maxPayment ?? ''))}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
