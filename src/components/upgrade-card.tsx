'use client';

import { useState } from 'react';
import { Check, ZapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/upgrade-dialog';

const DEFAULT_BULLETS = [
  'Comprar na planta',
  'Investir ou amortizar',
  'Meta de quitação',
  'Alugar ou comprar',
  'Consórcio vale a pena?',
];

export function UpgradeCard({
  isUnlimited,
  title = 'Exclusivo do Plano Ilimitado',
  subtitle = 'Ferramentas de decisão e simulações sem limites, sem gastar créditos.',
  bullets = DEFAULT_BULLETS,
  layout = 'wide',
  className,
}: {
  isUnlimited?: boolean;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  layout?: 'wide' | 'card';
  className?: string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isUnlimited) return null;

  if (layout === 'card') {
    return (
      <div
        className={cn(
          'flex w-full flex-col gap-4 rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-5 shadow-sm',
          className
        )}
      >
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 font-display text-base font-semibold">
            <ZapIcon className="size-4 text-[#820AD1]" />
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-[#820AD1]" />
              {bullet}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={() => setUpgradeOpen(true)} className="w-full">
          <ZapIcon className="size-4" />
          Assinar Ilimitado
        </Button>
        <p className="text-center text-xs text-muted-foreground">R$ 119,90/ano · cancele quando quiser.</p>
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-5 overflow-hidden rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8'
      )}
    >
      <div className="flex max-w-xl flex-col gap-2">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-[#820AD1]" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <Button type="button" onClick={() => setUpgradeOpen(true)} size="lg" className="w-full sm:w-auto">
          <ZapIcon className="size-4" />
          Assinar Ilimitado, R$ 119,90/ano
        </Button>
        <p className="text-xs text-muted-foreground">Cancele quando quiser.</p>
      </div>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
