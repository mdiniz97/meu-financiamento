"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { FAQS as faqs } from "@/lib/faq";


export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Tudo o que você precisa saber antes de começar.
          </p>
        </div>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {faqs.map((item, i) => (
            <div key={item.q}>
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
