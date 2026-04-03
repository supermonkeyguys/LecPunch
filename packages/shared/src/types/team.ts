export type TeamStatus = 'active' | 'inactive';

export interface Team {
  id: string;
  name: string;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
}
