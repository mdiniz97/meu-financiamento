'use client';

import { useState } from 'react';
import { Home, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradeDialog } from '@/components/upgrade-dialog';

export function AffordabilityLocked() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex w-full flex-1 items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            Qual imóvel cabe no meu bolso? <Home className="size-5 text-[#820AD1]" />
          </CardTitle>
          <CardDescription>
            Calcule imóvel máximo, entrada e cenários de comprometimento de renda.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4 text-[#820AD1]" /> Recurso exclusivo do plano Ilimitado
          </p>
          <Button type="button" onClick={() => setOpen(true)}>Ver opções de acesso</Button>
        </CardContent>
      </Card>
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
