'use client';

import { WizardForm } from '@/components/simulation/WizardForm';
import { SmartCalculatorExperience } from '@/components/simulation/SmartCalculatorExperience';

export function NovaSimulacaoClient({ isUnlimited }: { isUnlimited: boolean }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center gap-6 bg-muted p-6">
      <div className="grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-2">
        <WizardForm />
        <SmartCalculatorExperience isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
