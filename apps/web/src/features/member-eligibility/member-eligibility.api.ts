import { apiClient } from '@/shared/http/api-client';
import type { MemberEligibilityEntry, MemberEligibilityStatus } from '@lecpunch/shared';

export interface GetAdminMemberEligibilityEntriesQuery {
  keyword?: string;
  status?: MemberEligibilityStatus;
  limit?: number;
}

export interface UpsertAdminMemberEligibilityEntryInput {
  studentId: string;
  realName: string;
  status?: MemberEligibilityStatus;
  note?: string;
}

export interface UpdateAdminMemberEligibilityEntryInput {
  studentId?: string;
  realName?: string;
  status?: MemberEligibilityStatus;
  note?: string;
}

export const getAdminMemberEligibilityEntries = async (
  query: GetAdminMemberEligibilityEntriesQuery = {}
): Promise<MemberEligibilityEntry[]> => {
  const response = await apiClient.get<{ items: MemberEligibilityEntry[] }>('/member-eligibility/admin/entries', {
    params: query
  });
  return response.data.items;
};

export const createAdminMemberEligibilityEntry = async (
  input: UpsertAdminMemberEligibilityEntryInput
): Promise<MemberEligibilityEntry> => {
  const response = await apiClient.post<MemberEligibilityEntry>('/member-eligibility/admin/entries', input);
  return response.data;
};

export const updateAdminMemberEligibilityEntry = async (
  entryId: string,
  input: UpdateAdminMemberEligibilityEntryInput
): Promise<MemberEligibilityEntry> => {
  const response = await apiClient.patch<MemberEligibilityEntry>(`/member-eligibility/admin/entries/${entryId}`, input);
  return response.data;
};

export const deleteAdminMemberEligibilityEntry = async (entryId: string): Promise<void> => {
  await apiClient.delete(`/member-eligibility/admin/entries/${entryId}`);
};
