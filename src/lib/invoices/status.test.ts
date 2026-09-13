import { describe, expect, it } from 'vitest';
import { invoiceStatusLabel } from './status';

describe('invoiceStatusLabel', () => {
  it('traduz AUTHORIZED', () => {
    expect(invoiceStatusLabel('AUTHORIZED')).toBe('Autorizada');
  });

  it('traduz SCHEDULED', () => {
    expect(invoiceStatusLabel('SCHEDULED')).toBe('Agendada');
  });

  it('traduz PROCESSING_CANCELLATION', () => {
    expect(invoiceStatusLabel('PROCESSING_CANCELLATION')).toBe('Cancelando');
  });

  it('traduz CANCELED', () => {
    expect(invoiceStatusLabel('CANCELED')).toBe('Cancelada');
  });

  it('traduz CANCELLATION_DENIED', () => {
    expect(invoiceStatusLabel('CANCELLATION_DENIED')).toBe('Cancelamento negado');
  });

  it('traduz ERROR', () => {
    expect(invoiceStatusLabel('ERROR')).toBe('Erro');
  });

  it('devolve o próprio status quando desconhecido', () => {
    expect(invoiceStatusLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });
});
