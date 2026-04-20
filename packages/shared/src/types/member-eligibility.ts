export type MemberEligibilityStatus = 'allowed' | 'blocked';

export interface MemberEligibilityEntry {
  id: string;
  teamId: string;
  studentId: string;
  realName: string;
  status: MemberEligibilityStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
