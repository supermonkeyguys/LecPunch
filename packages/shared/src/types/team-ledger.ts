export type TeamLedgerType = 'income' | 'expense';

export interface TeamLedgerEntry {
  id: string;
  teamId: string;
  occurredAt: string;
  type: TeamLedgerType;
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
