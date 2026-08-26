import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { simulate } from '@/lib/finance/engine';
import { ReportDocument } from '@/lib/pdf/report';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';

const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) {
    return NextResponse.json(
      { error: 'Exportação em PDF é exclusiva do plano Ilimitado' },
      { status: 403 }
    );
  }

  let result: SimulationResult;
  try {
    const url = new URL(req.url);
    const raw = JSON.parse(url.searchParams.get('result') ?? '{}') as Partial<SimulationResult> & {
      input: LoanInput;
    };
    if (!raw?.input || typeof raw.input.principal !== 'number') {
      return NextResponse.json({ error: 'Parâmetro result inválido' }, { status: 400 });
    }
    if (Array.isArray(raw.installments) && raw.installments.length > 0 && raw.metrics) {
      result = raw as SimulationResult;
    } else {
      result = simulate(raw.input, raw.strategies ?? EMPTY);
    }
  } catch {
    return NextResponse.json({ error: 'Parâmetro result inválido' }, { status: 400 });
  }

  const buffer = await renderToBuffer(
    React.createElement(ReportDocument, { result }) as unknown as React.ReactElement<DocumentProps>
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="raio-x-financiamento.pdf"',
    },
  });
}
