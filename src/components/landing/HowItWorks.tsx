import { CalculatorIcon, LineChartIcon, TargetIcon } from "lucide-react";

const steps = [
  {
    icon: CalculatorIcon,
    step: "1",
    title: "Informe seus dados",
    description:
      "Valor do imóvel, entrada, taxa de juros e prazo. Leva menos de 2 minutos e você não precisa criar conta para simular.",
  },
  {
    icon: LineChartIcon,
    step: "2",
    title: "Veja o Raio X",
    description:
      "Parcelas, juros totais, amortização e a comparação completa entre SAC e PRICE em um só lugar, com gráficos claros.",
  },
  {
    icon: TargetIcon,
    step: "3",
    title: "Escolha a melhor estratégia",
    description:
      "Simule amortizações extras, uso do FGTS e portabilidade para pagar menos juros e quitar o imóvel mais rápido.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Como funciona
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Do valor do imóvel à melhor estratégia de pagamento em três passos
          simples.
        </p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map(({ icon: Icon, step, title, description }) => (
          <div
            key={step}
            className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#820AD1]/10 text-[#820AD1]">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-[#820AD1]/60">
                Passo {step}
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
