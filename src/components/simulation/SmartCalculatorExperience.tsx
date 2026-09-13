'use client';

import { useState } from 'react';
import type { SmartRecommendation } from '@/lib/finance/smart';
import { SmartCalculator, type SmartCalcFields } from '@/components/simulation/SmartCalculator';
import { SmartResultCard } from '@/components/simulation/SmartResultCard';

export function SmartCalculatorExperience({
  isUnlimited,
  showHeader,
}: {
  isUnlimited: boolean;
  showHeader?: boolean;
}) {
  const [rec, setRec] = useState<{ recommendation: SmartRecommendation; fields: SmartCalcFields } | null>(null);

  return (
    <div className="contents">
      <SmartCalculator
        isUnlimited={isUnlimited}
        showHeader={showHeader}
        onCalculated={(recommendation, fields) => setRec({ recommendation, fields })}
        onValidationFailed={() => setRec(null)}
      />
      {rec && (
        <div className="w-full lg:col-span-2">
          <SmartResultCard rec={rec.recommendation} fields={rec.fields} />
        </div>
      )}
    </div>
  );
}
