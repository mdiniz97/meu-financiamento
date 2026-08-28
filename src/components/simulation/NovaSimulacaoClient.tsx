'use client';

import { useState } from 'react';
import type { SmartRecommendation } from '@/lib/finance/smart';
import { WizardForm } from '@/components/simulation/WizardForm';
import { SmartCalculator, type SmartCalcFields } from '@/components/simulation/SmartCalculator';
import { SmartResultCard } from '@/components/simulation/SmartResultCard';

export function NovaSimulacaoClient({ isUnlimited }: { isUnlimited: boolean }) {
  const [rec, setRec] = useState<{ recommendation: SmartRecommendation; fields: SmartCalcFields } | null>(null);

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-6 bg-muted p-6">
      <div className="grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-2">
        <WizardForm />
        <SmartCalculator
          isUnlimited={isUnlimited}
          onCalculated={(recommendation, fields) => setRec({ recommendation, fields })}
        />
      </div>

      {rec && (
        <div className="w-full max-w-5xl">
          <SmartResultCard rec={rec.recommendation} fields={rec.fields} />
        </div>
      )}
    </div>
  );
}
