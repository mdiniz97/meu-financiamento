"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
  hover = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  hover?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  // Always render the same `motion.div` element (never branch to a plain <div>).
  // The server can't know the client's reduced-motion preference, so SSR always
  // renders the animated variant's initial inline style; if we swapped element
  // types based on `reduceMotion`, hydration would mismatch and React would
  // leave the stale `opacity: 0` style stuck in the DOM forever (it doesn't
  // patch mismatched attributes). Keeping the element type stable and only
  // varying the animation props avoids that, since Motion applies the final
  // props itself once mounted, regardless of what SSR guessed.
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      animate={reduceMotion ? { opacity: 1, y: 0 } : undefined}
      whileHover={hover && !reduceMotion ? { y: -4 } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);

  useEffect(() => {
    if (!isInView || !ref.current) return;

    if (reduceMotion) {
      ref.current.textContent = format(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [isInView, reduceMotion, value, format, motionValue]);

  return (
    <span ref={ref} className={className}>
      {format(0)}
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

  // Same rationale as Reveal above: keep the element type stable (always
  // `motion.span`) so SSR/hydration never disagree on structure, and only
  // vary the hover/tap animation props based on `reduceMotion`.
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
