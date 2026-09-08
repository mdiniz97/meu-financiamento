import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { simulate } from '@/lib/finance/engine';
import { ReportDocument } from './report';
import { buildComparisonPdf } from './comparison';

function infoField(pdf: string, field: 'Title' | 'Author') {
  const reference = pdf.match(new RegExp(`/${field} (\\d+) 0 R`));
  return reference
    ? pdf.match(new RegExp(`\\n${reference[1]} 0 obj\\n\\(([^\\n]*)\\)`))?.[1]
    : undefined;
}

describe('identidade dos documentos PDF', () => {
  it('relatório gerado identifica amortiza.me como título e autor', async () => {
    const result = simulate({
      system: 'PRICE', principal: 100000, annualRate: 0.1, months: 48,
      trMonthly: 0, insuranceMonthly: 0,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
    });
    const buffer = await renderToBuffer(ReportDocument({ result }));
    const pdf = buffer.toString('latin1');
    expect(infoField(pdf, 'Title')).toBe('amortiza.me');
    expect(infoField(pdf, 'Author')).toBe('amortiza.me');
  });

  it('comparação exportada tem a mesma identificação do relatório', async () => {
    const document = buildComparisonPdf({
      monthlyBudget: 12000,
      proposals: [
        { id: 'p1', bank: 'Caixa', propertyValue: 300000, downPayment: 60000, principal: 240000, system: 'PRICE', months: 360, annualRate: 0.1, cetInformed: 0.1, trMonthly: 0, insuranceMonthly: 0, fees: [] },
        { id: 'p2', bank: 'Itaú', propertyValue: 300000, downPayment: 60000, principal: 240000, system: 'SAC', months: 360, annualRate: 0.1, cetInformed: 0.1, trMonthly: 0, insuranceMonthly: 0, fees: [] },
      ],
    });
    const buffer = await renderToBuffer(document);
    const pdf = buffer.toString('latin1');
    expect(infoField(pdf, 'Title')).toBe('amortiza.me');
    expect(infoField(pdf, 'Author')).toBe('amortiza.me');
  });
});
