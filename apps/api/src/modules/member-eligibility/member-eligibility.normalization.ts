import { MemberEligibilityStatus } from '@lecpunch/shared';

export const normalizeEligibilityStudentId = (studentId: string) => studentId.trim();

export const normalizeEligibilityRealName = (realName: string) =>
  realName
    .trim()
    .replace(/\s+/g, ' ');

export const normalizeEligibilityStatus = (status?: string | null): MemberEligibilityStatus =>
  status === 'blocked' ? 'blocked' : 'allowed';

export const normalizeEligibilityNote = (note?: string | null) => {
  const normalized = note?.trim();
  return normalized ? normalized : undefined;
};
