'use client';

import { WizardForm } from '@/components/simulation/WizardForm';
import { SmartCalculatorExperience } from '@/components/simulation/SmartCalculatorExperience';
import { UpgradeCard } from '@/components/upgrade-card';

const BULLETS = [
  'Simulações sem gastar créditos',
  'Exportar PDF do resultado',
  'Comprar na planta',
  'Investir ou amortizar',
  'Meta de quitação',
  'Alugar ou comprar',
  'Consórcio vale a pena?',
];

export function NovaSimulacaoClient({ isUnlimited }: { isUnlimited: boolean }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center gap-6 bg-muted p-6">
      <div className="flex w-full max-w-5xl flex-col items-center gap-6">
        {!isUnlimited && (
          <UpgradeCard
            className="w-full"
            title="Quer mais? Vire Ilimitado"
            subtitle="Calcule sem limites, exporte PDF e desbloqueie as ferramentas de decisão exclusivas."
            bullets={BULLETS}
          />
        )}
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-2">
          <WizardForm isUnlimited={isUnlimited} />
          <SmartCalculatorExperience isUnlimited={isUnlimited} />
        </div>
      </div>
    </div>
  );
}
