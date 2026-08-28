"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type NumberFormat =
  | "brl"
  | "brlMilhao"
  | "brlApprox"
  | "brlMilhaoApprox"
  | "brlMilhoesRaw"
  | "pct"
  | "count";

const FORMATTERS: Record<NumberFormat, (v: number) => string> = {
  brl: (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v),
  brlMilhao: (v) => (v / 1_000_000).toFixed(v > 1_000_000 ? 2 : 3).replace(".", ",") + " mi",
  brlApprox: (v) => `~${FORMATTERS.brl(v)}`,
  brlMilhaoApprox: (v) => `~${FORMATTERS.brlMilhao(v)}`,
  // Value is already expressed in millions (e.g. 437.2), unlike `brlMilhao`
  // which divides a raw reais value by 1_000_000.
  brlMilhoesRaw: (v) => `R$ ${v.toFixed(1).replace(".", ",")} mi`,
  pct: (v) => `${Math.round(v)}%`,
  count: (v) => Math.round(v).toLocaleString("pt-BR"),
};

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: NumberFormat;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const formatFn = FORMATTERS[format];

  useEffect(() => {
    if (!isInView || !ref.current) return;

    if (reduceMotion) {
      ref.current.textContent = formatFn(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = formatFn(latest);
      },
    });
    return () => controls.stop();
  }, [isInView, reduceMotion, value, formatFn, motionValue]);

  return (
    <span ref={ref} className={className}>
      {formatFn(value)}
    </span>
  );
}

export function HoverScale({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className={cn("inline-block", className)}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      {children}
    </motion.span>
  );
}
