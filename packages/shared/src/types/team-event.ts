export type TeamEventStatus = 'planned' | 'done' | 'cancelled';

export interface TeamEvent {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  eventAt: string;
  status: TeamEventStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
