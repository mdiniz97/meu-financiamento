import { ArrowLeftRightIcon, CalculatorIcon, LockIcon, ShieldCheckIcon } from "lucide-react";

const trustItems = [
  { icon: ArrowLeftRightIcon, label: "Comparativo direto entre SAC e PRICE" },
  { icon: CalculatorIcon, label: "Cálculos com os dados reais do seu contrato" },
  { icon: ShieldCheckIcon, label: "Transparência total em cada etapa" },
  { icon: LockIcon, label: "Seus dados protegidos, sempre" },
];

export function TrustRow() {
  return (
    <section className="mx-auto w-full max-w-6xl border-b border-border px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {trustItems.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 p-5">
            <Icon className="size-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
