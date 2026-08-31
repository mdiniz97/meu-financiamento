import { describe, expect, it } from 'vitest';
import { nextProposalId } from './proposal-id';

describe('nextProposalId', () => {
  it('ignora ID numérico enorme e retorna primeiro slot conhecido livre', () => {
    expect(nextProposalId([{ id: 'p999999999999999999999999999999' }, { id: 'p2' }])).toBe('p1');
  });

  it('retorna null quando todos os slots limitados estão ocupados', () => {
    expect(nextProposalId(['p4', 'p2', 'p1', 'p3'].map((id) => ({ id })))).toBeNull();
  });
});
