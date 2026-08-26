'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SimulationResult } from '@/lib/finance/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ExportPdfButton({
  result,
  isUnlimited,
}: {
  result: SimulationResult;
  isUnlimited: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  if (!isUnlimited) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Exportação em PDF é exclusiva do plano Ilimitado"
        >
          Exportar PDF
        </Button>
        <Badge variant="secondary" className="text-xs">
          Exclusivo Ilimitado
        </Badge>
        <Link href="/planos" className="text-sm font-medium text-[#820AD1]">
          Ver planos
        </Link>
      </div>
    );
  }

  function handleExport() {
    setDownloading(true);
    const full = { ...result, installments: result.installments.slice(0, 360) };
    const encoded = encodeURIComponent(JSON.stringify(full));
    const payload =
      encoded.length <= 12000
        ? encoded
        : encodeURIComponent(JSON.stringify({ input: result.input, strategies: result.strategies }));
    window.open('/api/pdf?result=' + payload, '_blank');
    setTimeout(() => setDownloading(false), 1500);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={downloading}>
      {downloading ? 'Gerando…' : 'Exportar PDF'}
    </Button>
  );
}
