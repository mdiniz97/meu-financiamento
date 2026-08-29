import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { buildComparisonPdf } from '@/lib/pdf/comparison';
import { deserializeComparisonInput } from '@/lib/comparator/serialize';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.userId) return new Response('Não autenticado', { status: 401 });
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) return new Response('Recurso exclusivo do plano Ilimitado', { status: 403 });
  const { searchParams } = new URL(req.url);
  const rawProposals = searchParams.get('proposals');
  const monthlyBudget = Number(searchParams.get('monthlyBudget') ?? '0');
  if (!rawProposals || !(monthlyBudget > 0)) return new Response('Parâmetros inválidos', { status: 400 });
  try {
    const input = deserializeComparisonInput(
      JSON.stringify({ version: 1, proposals: JSON.parse(rawProposals), monthlyBudget })
    );
    const pdf = await renderToBuffer(buildComparisonPdf(input));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="comparacao-propostas.pdf"',
      },
    });
  } catch {
    return new Response('Dados inválidos', { status: 400 });
  }
}
