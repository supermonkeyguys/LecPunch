export type TeamLedgerType = 'income' | 'expense';
export type TeamLedgerEntryStatus = 'active' | 'voided';

export interface TeamLedgerEntry {
  id: string;
  teamId: string;
  occurredAt: string;
  type: TeamLedgerType;
  status: TeamLedgerEntryStatus;
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
  proofFileName?: string;
  proofFileMimeType?: string;
  proofFileBase64?: string;
  reversalOfEntryId?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
