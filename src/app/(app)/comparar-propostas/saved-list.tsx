'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { deleteComparison, type ComparisonSummary } from './actions';

export function SavedList({ initial }: { initial: ComparisonSummary[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  if (items.length === 0) return null;
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex flex-col gap-2 pt-6">
        <h2 className="text-base font-semibold">Comparações salvas</h2>
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                Melhor: {c.bestBank ?? '—'} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/comparar-propostas?id=${c.id}`)}>
                Abrir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm('Excluir esta comparação?')) return;
                  await deleteComparison(c.id);
                  setItems((xs) => xs.filter((x) => x.id !== c.id));
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
