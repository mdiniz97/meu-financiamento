'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConsorcioCalculator } from '@/components/simulation/ConsorcioCalculator';
import { ConsorcioInvestirCalculator } from '@/components/simulation/ConsorcioInvestirCalculator';

export function ConsorcioValeAPenaTabs({
  isUnlimited,
  selicAnnual,
}: {
  isUnlimited: boolean;
  selicAnnual: number | null;
}) {
  return (
    <Tabs defaultValue="financiamento" className="flex w-full flex-col gap-5">
      <TabsList className="h-10 w-full sm:w-fit" aria-label="Forma de comparação">
        <TabsTrigger value="financiamento" className="px-4">vs Financiar</TabsTrigger>
        <TabsTrigger value="investir" className="px-4">vs Investir</TabsTrigger>
      </TabsList>
      <TabsContent value="financiamento">
        <ConsorcioCalculator isUnlimited={isUnlimited} />
      </TabsContent>
      <TabsContent value="investir">
        <ConsorcioInvestirCalculator isUnlimited={isUnlimited} selicAnnual={selicAnnual} />
      </TabsContent>
    </Tabs>
  );
}
