"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/motion-primitives";

const faqs = [
  {
    q: "Qual a diferença entre SAC e PRICE?",
    a: "No SAC a amortização é fixa: a parcela começa maior e cai todo mês, e a dívida abate desde a primeira parcela. No PRICE a parcela é constante, mas no começo quase tudo é juro — e com a correção (TR) a dívida pode até crescer nos primeiros anos. No total, o SAC costuma pagar bem menos juros.",
  },
  {
    q: "Vale a pena amortizar o financiamento?",
    a: "Sim, quase sempre. Cada real amortizado deixa de render juros até o fim do contrato — uma amortização pequena pode economizar muitas vezes o seu valor em juros. O nosso simulador mostra exatamente quanto você economiza e o quanto o prazo encurta.",
  },
  {
    q: "O que é o 'Raio X da dívida'?",
    a: "É uma análise que mostra em que mês a sua dívida começa a cair de verdade, a parcela mínima que ainda abate o saldo e o prazo ideal para o seu financiamento. Com ela você entende se a sua parcela atual está pagando a dívida ou só os juros.",
  },
  {
    q: "O que é o cálculo inteligente?",
    a: "Você informa quanto pode pagar por mês e o sistema descobre o melhor modelo (SAC ou PRICE), o melhor prazo e o melhor aporte mensal para o seu orçamento, minimizando o total pago.",
  },
  {
    q: "O que é portabilidade e como saber se compensa?",
    a: "Portabilidade é trocar o financiamento de banco por uma taxa menor. O simulador compara manter o contrato atual com portar para a nova taxa, mostra a economia total, a diferença de parcela e o mês em que os custos da portabilidade se pagam.",
  },
  {
    q: "Preciso criar conta para usar?",
    a: "Sim — ao criar a conta você ganha 2 créditos de boas-vindas para testar. Depois, é só escolher entre créditos avulsos (R$ 10 por 10 simulações) ou o plano Ilimitado (R$ 99,90/mês).",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto w-full max-w-3xl border-b border-border px-4 py-20 sm:px-6">
      <Reveal>
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Tudo o que você precisa saber antes de começar.
          </p>
        </div>
      </Reveal>
      <div className="mt-10 divide-y divide-border border-y border-border">
        {faqs.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.05}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-2 py-4 text-left"
              aria-expanded={open === i}
            >
              <span className="font-semibold">{item.q}</span>
              <ChevronDownIcon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  open === i && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-2 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
