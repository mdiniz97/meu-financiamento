export interface ComparatorFee {
  id: string;
  label: string;
  amount: number;
  includeInCet: boolean;
}

export interface ComparatorProposal {
  id: string;
  bank: string;
  name?: string;
  propertyValue: number;
  downPayment: number;
  principal: number;
  principalManual?: boolean;
  system: 'SAC' | 'PRICE';
  months: number;
  annualRate: number;
  annualRateValue?: number;
  annualRateKind?: RateKind;
  cetInformed: number;
  trMonthly: number;
  insuranceMonthly: number;
  fees: ComparatorFee[];
}

export interface ComparatorInput {
  proposals: ComparatorProposal[];
  monthlyBudget: number;
}

export interface ProposalError {
  id: string;
  message: string;
}

import type { RateKind } from '@/lib/finance/rates';
