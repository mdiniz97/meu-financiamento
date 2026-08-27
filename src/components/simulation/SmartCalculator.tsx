'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { maxFinancing, recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import { BANKS } from '@/lib/simulation-context';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export interface SmartCalcFields {
  principal: string;
  annualRate: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  maxMonths: string;
  maxPayment: string;
  fixedUntilMonth: string;
}

export const SMART_DEFAULTS: SmartCalcFields = {
  principal: '1000000',
  annualRate: '10.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  maxMonths: '360',
  maxPayment: '12000',
  fixedUntilMonth: '',
};

interface Props {
  isUnlimited: boolean;
  onCalculated: (rec: SmartRecommendation, fields: SmartCalcFields) => void;
}

export function SmartCalculator({ isUnlimited, onCalculated }: Props) {
  const [f, setF] = useState<SmartCalcFields>(SMART_DEFAULTS);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFields, setModalFields] = useState({
    parcela: '12000',
    annualRate: '10.5',
    trMonthly: '0.17',
    insuranceMonthly: '100',
    months: '360',
  });
  const [modalResult, setModalResult] = useState<{ PRICE: number; SAC: number } | null>(null);
  const [modalError, setModalError] = useState('');

  const set = <K extends keyof SmartCalcFields>(k: K, v: SmartCalcFields[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function calcular() {
    setError('');
    const principal = parseBRLToNumber(f.principal);
    const annualRate = parseDecimal(f.annualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const maxMonths = Number(f.maxMonths);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    const until = Number(f.fixedUntilMonth);
    if (!(principal > 0)) return setError('Informe o valor financiado (maior que zero).');
    if (!(annualRate > 0)) return setError('Informe a taxa anual (maior que zero).');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro mensal válido.');
    if (!(maxMonths >= 60 && maxMonths <= 600)) return setError('Prazo máximo deve estar entre 60 e 600 meses.');
    if (!(maxPayment > 0)) return setError('Informe quanto pode pagar por mês.');

    const rec = recommendSmart({
      principal,
      annualRate: annualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      bank: f.bank,
      maxMonths,
      maxPayment,
      fixedUntilMonth: Number.isInteger(until) && until >= 1 ? until : undefined,
    });
    onCalculated(rec, f);
  }

  function usarNoInteligente(principal: number) {
    // leva o valor descoberto para o cálculo inteligente
    set('principal', String(principal));
    set('maxPayment', modalFields.parcela);
    set('annualRate', modalFields.annualRate);
    set('trMonthly', modalFields.trMonthly);
    set('insuranceMonthly', modalFields.insuranceMonthly);
    set('maxMonths', modalFields.months);
    setModalOpen(false);
  }

  return (
    <Card className="flex h-full w-full flex-col rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Cálculo inteligente <Sparkles className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e estratégia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!isUnlimited ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <Sparkles className="mx-auto size-8 text-[#820AD1]" />
            <p className="text-sm text-muted-foreground">
              Recurso exclusivo do plano Ilimitado.
            </p>
            <Badge variant="secondary" className="mx-auto text-xs">
              Exclusivo Ilimitado
            </Badge>
            <Link href="/planos" className="mx-auto text-sm font-medium text-[#820AD1]">
              Ver planos
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalFields({
                    parcela: f.maxPayment,
                    annualRate: f.annualRate,
                    trMonthly: f.trMonthly,
                    insuranceMonthly: f.insuranceMonthly,
                    months: f.maxMonths,
                  });
                  setModalResult(null);
                  setModalOpen(true);
                }}
              >
                <Search className="size-3.5" /> Descobrir quanto posso financiar
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartPrincipal">Valor financiado (R$)</Label>
                <MoneyInput
                id="smartPrincipal"
                value={parseBRLToNumber(f.principal)}
                onValid={(v) => set("principal", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartRate">Taxa a.a. (%)</Label>
                <NumericInput
                id="smartRate"
                value={parseDecimal(f.annualRate)}
                parse={parseDecimal}
                onValid={(v) => set("annualRate", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartTr">TR mensal (%)</Label>
                <NumericInput
                id="smartTr"
                value={parseDecimal(f.trMonthly)}
                parse={parseDecimal}
                onValid={(v) => set("trMonthly", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartSeguro">Seguro (R$/mês)</Label>
                <MoneyInput
                id="smartSeguro"
                value={parseBRLToNumber(f.insuranceMonthly)}
                onValid={(v) => set("insuranceMonthly", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Banco</Label>
                <Select value={f.bank} onValueChange={(v) => set('bank', String(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartMaxMonths">Prazo máximo (meses)</Label>
                <NumericInput
                id="smartMaxMonths"
                value={Number(f.maxMonths)}
                parse={parseIntStrict}
                onValid={(v) => set("maxMonths", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartMaxPayment2">Quanto pode pagar por mês (R$)</Label>
                <MoneyInput
                  id="smartMaxPayment2"
                  value={parseBRLToNumber(f.maxPayment)}
                  onValid={(v) => set("maxPayment", String(v))}
                />
                <p className="text-xs text-muted-foreground">
                  Parcela + aporte automático = sempre esse valor, até quitar.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartFixedUntil">Pagar esse valor só até o mês (opcional)</Label>
                <NumericInput
                  id="smartFixedUntil"
                  value={f.fixedUntilMonth ? Number(f.fixedUntilMonth) : undefined}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) => set('fixedUntilMonth', v > 0 ? String(v) : '')}
                />
                <p className="text-xs text-muted-foreground">
                  Depois, volta a pagar só a parcela do contrato.
                </p>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <Button type="button" onClick={calcular}>
                <Sparkles className="size-4" /> Calcular melhor modelo
              </Button>
            </div>


            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quanto você pode financiar</DialogTitle>
            <DialogDescription>
              Informe quanto quer pagar por mês — calculamos o valor máximo do imóvel em cada
              modelo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfParcela">Quanto quer pagar por mês (R$)</Label>
                <MoneyInput
                  id="mfParcela"
                  value={parseBRLToNumber(modalFields.parcela)}
                  onValid={(v) => setModalFields((p) => ({ ...p, parcela: String(v) }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfMonths">Prazo (meses)</Label>
                  <NumericInput
                    id="mfMonths"
                    value={Number(modalFields.months)}
                    parse={parseIntStrict}
                    onValid={(v) => setModalFields((p) => ({ ...p, months: String(v) }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfRate">Taxa a.a. (%)</Label>
                  <NumericInput
                    id="mfRate"
                    value={parseDecimal(modalFields.annualRate)}
                    parse={parseDecimal}
                    onValid={(v) => setModalFields((p) => ({ ...p, annualRate: String(v) }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfTr">TR mensal (%)</Label>
                  <NumericInput
                    id="mfTr"
                    value={parseDecimal(modalFields.trMonthly)}
                    parse={parseDecimal}
                    onValid={(v) => setModalFields((p) => ({ ...p, trMonthly: String(v) }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfSeguro">Seguro (R$/mês)</Label>
                  <MoneyInput
                    id="mfSeguro"
                    value={parseBRLToNumber(modalFields.insuranceMonthly)}
                    onValid={(v) => setModalFields((p) => ({ ...p, insuranceMonthly: String(v) }))}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    setModalError('');
                    const parcela = parseBRLToNumber(modalFields.parcela);
                    const rate = parseDecimal(modalFields.annualRate);
                    const tr = parseDecimal(modalFields.trMonthly);
                    const seguro = parseBRLToNumber(modalFields.insuranceMonthly);
                    const months = Number(modalFields.months);
                    if (!(parcela > 0)) return setModalError('Informe quanto quer pagar por mês.');
                    if (!(rate > 0)) return setModalError('Informe a taxa anual.');
                    if (!(tr >= 0)) return setModalError('Informe a TR mensal.');
                    if (!(seguro >= 0)) return setModalError('Informe o seguro.');
                    if (!(months >= 1 && months <= 600)) return setModalError('Prazo entre 1 e 600 meses.');
                    setModalResult(
                      maxFinancing({
                        maxPayment: parcela,
                        annualRate: rate / 100,
                        trMonthly: tr / 100,
                        insuranceMonthly: seguro,
                        bank: f.bank,
                        months,
                      })
                    );
                  }}
                >
                  <Search className="size-4" /> Calcular
                </Button>
              </div>
              {modalError && <p className="text-sm text-destructive">{modalError}</p>}
            </div>

            {modalResult && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">
                  Com {formatBRL(parseBRLToNumber(modalFields.parcela))}/mês, você pode financiar até:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['PRICE', 'SAC'] as const).map((s) => (
                    <div key={s} className="flex flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-sm">
                      <span className="text-xs text-muted-foreground">No {s}</span>
                      <span className="text-lg font-semibold text-primary break-all">
                        {formatBRL(modalResult[s])}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s === 'PRICE'
                          ? 'Parcela constante — cresce com a TR'
                          : 'Parcela começa maior e cai'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => usarNoInteligente(Math.max(modalResult.PRICE, modalResult.SAC))}
                  >
                    Usar no cálculo inteligente
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O cálculo inteligente usa o maior valor (no {modalResult.PRICE >= modalResult.SAC ? 'PRICE' : 'SAC'}) e
                  descobre o melhor modelo, prazo e estratégia para ele.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
