import { LockIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/landing/motion-primitives";

export function StatsBar() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <AnimatedNumber value={10000} format="count" className="font-mono text-2xl font-bold font-mono tabular-nums" />
            <span className="text-sm text-muted-foreground">análises realizadas</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <AnimatedNumber
              value={437.2}
              format="brlMilhoesRaw"
              className="font-mono text-2xl font-bold font-mono tabular-nums text-primary"
            />
            <span className="text-sm text-muted-foreground">em economia gerada</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <AnimatedNumber value={99} format="pct" className="font-mono text-2xl font-bold font-mono tabular-nums" />
            <span className="text-sm text-muted-foreground">de satisfação</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <LockIcon className="size-6 text-primary" />
            <span className="mt-1 text-sm text-muted-foreground">
              Zero compartilhamento de dados com outras instituições
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
