'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { calcularCustosCompra, UF_CUSTOS, type CustosCompraResult } from '@/lib/finance/custos-compra';
import { formatBRL, numberToBRLInput, parseBRLToNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export function CompraCustosCalculator() {
  const [imovel, setImovel] = useState('500000,00');
  const [entradaPct, setEntradaPct] = useState('20');
  const [uf, setUf] = useState('SP');
  const [extras, setExtras] = useState('3000,00');
  const [result, setResult] = useState<CustosCompraResult | null>(null);
  const [resultForm, setResultForm] = useState<{ imovel: string; entradaPct: string; uf: string } | null>(null);
  const [error, setError] = useState('');

  const rf = resultForm;

  function calcular() {
    setError('');
    const valor = parseBRLToNumber(imovel);
    const pct = Number(entradaPct);
    const extra = parseBRLToNumber(extras);
    if (!(valor > 0)) return setError('Informe o valor do imóvel.');
    if (!(pct >= 5 && pct <= 95)) return setError('Entrada deve ficar entre 5% e 95%.');

    try {
      setResult(
        calcularCustosCompra({
          valorImovel: valor,
          entradaPct: pct,
          uf,
          custosExtras: extra,
        })
      );
      setResultForm({ imovel, entradaPct, uf });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular.');
    }
  }


  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5 text-[#820AD1]" /> Custos da compra
          </CardTitle>
          <CardDescription>
            Veja quanto precisa ter em mãos além do financiamento: entrada, ITBI, cartório e
            registro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FieldHelp htmlFor="ccImovel" label="Valor do imóvel (R$)" help="Preço total do imóvel, antes de qualquer desconto.">
              <MoneyInput id="ccImovel" aria-describedby="ccImovel-help" value={parseBRLToNumber(imovel)} onValid={(v) => setImovel(numberToBRLInput(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="ccEntrada" label="Entrada (%)" help="Percentual do imóvel pago à vista. O comum no financiamento é 20%.">
              <NumericInput id="ccEntrada" aria-describedby="ccEntrada-help" value={Number(entradaPct)} parse={(s) => (s.trim() === '' ? 0 : Number(s.replace(/\D/g, '')))} onValid={(v) => setEntradaPct(String(v))} />
            </FieldHelp>
            <FieldHelp htmlFor="ccUf" label="Estado (UF)" help="ITBI e registro variam por município; usamos médias estaduais estimadas.">
              <Select value={uf} onValueChange={(v) => setUf(String(v))}>
                <SelectTrigger id="ccUf" aria-describedby="ccUf-help" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(UF_NAMES).map(([sigla, nome]) => (
                    <SelectItem key={sigla} value={sigla}>{sigla} - {nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldHelp>
            <FieldHelp htmlFor="ccExtras" label="Extras (R$)" help="Avaliação do imóvel, certidões, reconhecimento de firma e outros. Zero se não quiser incluir.">
              <MoneyInput id="ccExtras" aria-describedby="ccExtras-help" value={parseBRLToNumber(extras)} onValid={(v) => setExtras(numberToBRLInput(v))} />
            </FieldHelp>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="ml-auto">
              <Button type="button" onClick={calcular}>
                Calcular custos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && rf && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg">Você precisa ter à vista</CardTitle>
            <CardDescription>
              Para um imóvel de {formatBRL(parseBRLToNumber(rf.imovel))} com {rf.entradaPct}% de entrada em {UF_CUSTOS[rf.uf].itbi}% de ITBI ({UF_NAMES[rf.uf]}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4">
              <p className="text-sm">
                <strong className="text-[#820AD1]">Total à vista: {formatBRL(result.totalDesembolso)}</strong>
                {' '}para entrar no imóvel. O financiamento cobre {formatBRL(result.financiado)}, o resto sai do seu bolso.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Entrada', desc: `${rf.entradaPct}% do imóvel`, value: formatBRL(result.entrada) },
                { label: 'ITBI', desc: `Média de ${UF_CUSTOS[rf.uf].itbi}% (${UF_NAMES[rf.uf]})`, value: formatBRL(result.itbi) },
                { label: 'Escritura e registro', desc: `Média de ${UF_CUSTOS[rf.uf].registro}%`, value: formatBRL(result.registro) },
                { label: 'Extras', desc: 'Avaliação, certidões e outros', value: formatBRL(result.extras) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-muted/50 p-4">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="font-mono tabular-nums text-lg font-semibold">{item.value}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimativa educativa: ITBI é definido por município e a escritura pelo tabelionato
              local. Consulte a prefeitura e o cartório da sua cidade para os valores oficiais.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
