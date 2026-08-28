'use client';

import { Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BuyPackButton } from '@/app/(app)/planos/buy-pack-button';

export function UpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4" /> Recurso exclusivo do plano Ilimitado
          </DialogTitle>
          <DialogDescription>
            Escolha como destravar: créditos avulsos para usar pontualmente, ou a assinatura
            Ilimitado com tudo liberado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4">
            <span className="font-semibold">10 créditos</span>
            <span className="text-sm text-muted-foreground">
              R$ 10,00 à vista, sem assinatura. Cada simulação completa usa 1 crédito.
            </span>
            <BuyPackButton packId="credits10" label="Comprar 10 créditos – R$ 10,00" />
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4 ring-2 ring-[#820AD1]">
            <span className="font-semibold">Plano Ilimitado</span>
            <span className="text-sm text-muted-foreground">
              R$ 99,90/mês. Simulações ilimitadas, raio X, PDF, cálculo inteligente e portabilidade.
            </span>
            <BuyPackButton packId="unlimited" label="Assinar Ilimitado – R$ 99,90/mês" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
