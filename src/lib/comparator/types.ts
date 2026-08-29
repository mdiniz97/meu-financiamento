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
  system: 'SAC' | 'PRICE';
  months: number;
  annualRate: number;
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
