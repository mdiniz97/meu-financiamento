'use client';

import { Landmark } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConsorcioCalculator } from '@/components/simulation/ConsorcioCalculator';
import { ConsorcioInvestirCalculator } from '@/components/simulation/ConsorcioInvestirCalculator';

export function ConsorcioValeAPenaTabs({ selicAnnual }: { selicAnnual: number | null }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
          <Landmark className="size-5 text-[#820AD1]" /> Consórcio vale a pena?
        </CardTitle>
        <CardDescription>
          Compare o consórcio com o financiamento ou com investir a parcela todo mês.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="financiamento" className="flex w-full flex-col gap-5">
          <TabsList className="h-10 w-full sm:w-fit" aria-label="Forma de comparação">
            <TabsTrigger value="financiamento" className="px-4">vs Financiar</TabsTrigger>
            <TabsTrigger value="investir" className="px-4">vs Investir</TabsTrigger>
          </TabsList>
          <TabsContent value="financiamento">
            <ConsorcioCalculator />
          </TabsContent>
          <TabsContent value="investir">
            <ConsorcioInvestirCalculator selicAnnual={selicAnnual} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
