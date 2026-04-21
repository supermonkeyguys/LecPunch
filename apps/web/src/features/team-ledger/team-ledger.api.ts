import { apiClient } from '@/shared/http/api-client';
import type { TeamLedgerEntry, TeamLedgerEntryStatus, TeamLedgerType } from '@lecpunch/shared';

export interface GetAdminTeamLedgerEntriesQuery {
  from?: string;
  to?: string;
  type?: TeamLedgerType;
  status?: TeamLedgerEntryStatus | 'all';
  category?: string;
  limit?: number;
}

export interface CreateAdminTeamLedgerEntryInput {
  occurredAt: string;
  type: TeamLedgerType;
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
}

export interface TeamLedgerSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entryCount: number;
}

export interface TeamLedgerTrendItem {
  bucketKey: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entryCount: number;
}

export interface GetAdminTeamLedgerTrendQuery {
  from?: string;
  to?: string;
  status?: TeamLedgerEntryStatus | 'all';
  granularity?: 'day' | 'week';
}

export const getAdminTeamLedgerEntries = async (
  query: GetAdminTeamLedgerEntriesQuery = {}
): Promise<TeamLedgerEntry[]> => {
  const response = await apiClient.get<{ items: TeamLedgerEntry[] }>('/team-ledger/admin/entries', {
    params: query
  });
  return response.data.items;
};

export const createAdminTeamLedgerEntry = async (
  input: CreateAdminTeamLedgerEntryInput
): Promise<TeamLedgerEntry> => {
  const response = await apiClient.post<TeamLedgerEntry>('/team-ledger/admin/entries', input);
  return response.data;
};

export const voidAdminTeamLedgerEntry = async (entryId: string, reason?: string): Promise<TeamLedgerEntry> => {
  const response = await apiClient.patch<TeamLedgerEntry>(`/team-ledger/admin/entries/${entryId}/void`, { reason });
  return response.data;
};

export const createAdminTeamLedgerReversal = async (entryId: string, note?: string): Promise<TeamLedgerEntry> => {
  const response = await apiClient.post<TeamLedgerEntry>(`/team-ledger/admin/entries/${entryId}/reversal`, { note });
  return response.data;
};

export const getAdminTeamLedgerSummary = async (query: Pick<GetAdminTeamLedgerEntriesQuery, 'from' | 'to' | 'status'> = {}): Promise<TeamLedgerSummary> => {
  const response = await apiClient.get<TeamLedgerSummary>('/team-ledger/admin/summary', {
    params: query
  });
  return response.data;
};

export const getAdminTeamLedgerTrend = async (
  query: GetAdminTeamLedgerTrendQuery = {}
): Promise<TeamLedgerTrendItem[]> => {
  const response = await apiClient.get<{ items: TeamLedgerTrendItem[] }>('/team-ledger/admin/trend', {
    params: query
  });
  return response.data.items;
};
