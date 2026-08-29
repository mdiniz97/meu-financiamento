"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  price: string;
  sac: string;
  smart: string;
}

interface DashboardTabsProps {
  sidebarItems: string[];
  comparativoRows: Row[];
  amortizacaoRows: Row[];
  parcelaInicialPrice: string;
  parcelaInicialSac: string;
  economiaTotal: string;
  chartSeries: { price: string; sac: string; smart: string };
}

function ComparisonTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1.2fr_0.85fr_0.85fr_1.2fr] gap-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="text-right">PRICE</span>
        <span className="text-right">SAC</span>
        <span className="text-right normal-case text-primary">Com amortizador inteligente</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1.2fr_0.85fr_0.85fr_1.2fr] gap-2 border-b border-border py-2.5 text-sm last:border-0"
        >
          <span className="text-muted-foreground">{row.label}</span>
          <span className="text-right font-mono tabular-nums">{row.price}</span>
          <span className="text-right font-mono tabular-nums">{row.sac}</span>
          <span className="text-right font-mono font-bold tabular-nums text-primary">{row.smart}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardTabs({
  sidebarItems,
  comparativoRows,
  amortizacaoRows,
  parcelaInicialPrice,
  parcelaInicialSac,
  economiaTotal,
  chartSeries,
}: DashboardTabsProps) {
  const [active, setActive] = useState(1);

  return (
    <div className="mt-12 grid border border-border sm:grid-cols-[160px_1fr]">
      <div
        role="tablist"
        className="flex divide-x divide-border overflow-x-auto border-b border-border sm:flex-col sm:divide-x-0 sm:divide-y sm:overflow-visible sm:border-b-0 sm:border-r"
      >
        {sidebarItems.map((item, i) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "whitespace-nowrap p-4 text-left text-xs",
              i === active ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-6">
        {active === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Parcela inicial PRICE</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{parcelaInicialPrice}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Parcela inicial SAC</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{parcelaInicialSac}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Economia total escolhendo certo</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-emerald-600">{economiaTotal}</span>
            </div>
          </div>
        )}

        {active === 1 && <ComparisonTable title="Comparativo SAC × PRICE" rows={comparativoRows} />}

        {active === 2 && <ComparisonTable title="Amortização por mês" rows={amortizacaoRows} />}

        {active === 3 && (
          <div className="flex flex-col gap-3">
            <svg
              viewBox="-3 -3 306 86"
              className="w-full text-border"
              role="img"
              aria-label="Evolução do saldo devedor ao longo do financiamento: o amortizador inteligente quita a dívida mais rápido que PRICE e SAC."
            >
              <polyline
                points={chartSeries.price}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <polyline
                points={chartSeries.sac}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <polyline
                points={chartSeries.smart}
                fill="none"
                className="text-[#820AD1]"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-border" /> PRICE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t border-dashed border-border" /> SAC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#820AD1]" /> Amortizador inteligente
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
