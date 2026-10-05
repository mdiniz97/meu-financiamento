'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Handshake } from 'lucide-react';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput, NumericInput, parseIntStrict, RateField } from './form-inputs';
import { evaluateNegotiation, type NegotiationResult } from '@/lib/finance/negotiation';
import type { AmortSystem } from '@/lib/finance/types';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';
import { listNegotiations, type SavedNegotiation } from '@/app/(app)/negociacao/actions';

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

export function NegotiationCalculator() {
  const [f, setF] = useState<Form>(DEFAULTS);
  const [rateValid, setRateValid] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [saved, setSaved] = useState<SavedNegotiation[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const refresh = useCallback(async () => setSaved(await listNegotiations()), []);
  useEffect(() => {
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
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="flex items-center gap-2 font-display text-xl">
            <Handshake className="size-5 text-[#820AD1]" /> Mesa de negociação
          </CardTitle>
          <CardDescription>
            Informe a proposta e o teto de parcela: veja se fecha e onde apertar antes de assinar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
          <FieldHelp htmlFor="ngTeto" label="Teto de parcela (R$)" help="O máximo que cabe no seu orçamento por mês.">
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
            <CardTitle className="text-base">
              {result.fits
                ? (result.slackMonthly < 50 ? 'No limite — fecha apertado' : 'Fecha no seu orçamento')
                : 'Não fecha com esse teto'}
            </CardTitle>
            <CardDescription>
              Parcela inicial {formatBRL(result.initialPayment)} · pico {formatBRL(result.peakPayment)} no mês {result.peakPaymentMonth} · folga {formatBRL(result.slackMonthly)}/mês
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs text-muted-foreground">Taxa máxima</span>
              <p className="font-semibold">{result.maxAnnualRate === null ? 'Nem a 0% cabe' : fmtRate(result.maxAnnualRate)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Entrada mínima</span>
              <p className="font-semibold">{formatBRL(result.minDownPayment)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Prazo mínimo viável</span>
              <p className="font-semibold">{result.minMonths} meses</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Financia no máximo</span>
              <p className="font-semibold">{formatBRL(result.maxPrincipal)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Imóvel que cabe</span>
              <p className="font-semibold">{formatBRL(result.maxPropertyValue)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Script para a conversa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              {result.fits
                ? `Fecha no teto de ${formatBRL(teto)}. `
                : `Com o teto de ${formatBRL(teto)} não fecha. `}
              {result.maxAnnualRate !== null
                ? `Peça taxa ≤ ${fmtRate(result.maxAnnualRate)}`
                : 'Nenhuma taxa faz caber'}
              {' '}ou entrada ≥ {formatBRL(result.minDownPayment)}; prazo mínimo viável {result.minMonths} meses.
            </p>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={save}>Salvar oferta</Button>
              {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {saved.length > 0 && (
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
