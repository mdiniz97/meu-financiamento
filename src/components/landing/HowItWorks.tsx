import { CalculatorIcon, LightbulbIcon, SparklesIcon, TargetIcon } from "lucide-react";

const steps = [
  {
    icon: CalculatorIcon,
    step: "1",
    title: "Informe seus dados",
    description:
      "Valor do imóvel, taxa de juros, prazo e seguro. Leva menos de 2 minutos.",
  },
  {
    icon: LightbulbIcon,
    step: "2",
    title: "Veja o Raio X",
    description:
      "Parcelas, juros totais, amortização e a comparação completa entre SAC e PRICE, com o mês em que a dívida começa a cair de verdade.",
  },
  {
    icon: TargetIcon,
    step: "3",
    title: "Escolha a melhor estratégia",
    description:
      "Simule amortizações extras, FGTS, pagamento fixo e portabilidade para pagar menos juros e quitar o imóvel mais rápido.",
  },
  {
    icon: SparklesIcon,
    step: "4",
    title: "Ou deixe o cálculo inteligente decidir",
    description:
      "Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e aporte para o seu orçamento.",
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
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
