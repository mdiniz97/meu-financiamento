import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invoiceStatusLabel } from '@/lib/invoices/status';

export async function InvoicesCard({ userId }: { userId: string }) {
  const notes = await db.query.invoices.findMany({
    where: eq(schema.invoices.userId, userId),
    orderBy: (invoices) => [sql`${invoices.effectiveDate} desc nulls last`],
    limit: 24,
  });

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Notas fiscais</CardTitle>
        <CardDescription>Notas de serviço emitidas para seus pagamentos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {notes.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma nota emitida ainda.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {note.effectiveDate
                    ? new Date(note.effectiveDate).toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                      })
                    : '-'}
                </span>
                <span className="text-muted-foreground">
                  {note.valueCents != null ? formatBRL(note.valueCents / 100) : '-'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{invoiceStatusLabel(note.status)}</Badge>
                {note.pdfUrl ? (
                  <a
                    href={note.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    PDF
                  </a>
                ) : null}
                {note.xmlUrl ? (
                  <a
                    href={note.xmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    XML
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
