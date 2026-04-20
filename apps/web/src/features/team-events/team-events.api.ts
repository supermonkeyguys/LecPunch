import { apiClient } from '@/shared/http/api-client';
import type { TeamEvent, TeamEventStatus } from '@lecpunch/shared';

export interface GetAdminTeamEventsQuery {
  status?: TeamEventStatus;
  from?: string;
  to?: string;
  limit?: number;
}

export interface GetTeamEventsQuery {
  status?: TeamEventStatus;
  limit?: number;
}

export interface UpsertAdminTeamEventInput {
  title: string;
  description?: string;
  eventAt: string;
  status?: TeamEventStatus;
}

export interface UpdateAdminTeamEventInput {
  title?: string;
  description?: string;
  eventAt?: string;
  status?: TeamEventStatus;
}

export const getAdminTeamEvents = async (query: GetAdminTeamEventsQuery = {}): Promise<TeamEvent[]> => {
  const response = await apiClient.get<{ items: TeamEvent[] }>('/team-events/admin/events', {
    params: query
  });
  return response.data.items;
};

export const getTeamEvents = async (query: GetTeamEventsQuery = {}): Promise<TeamEvent[]> => {
  const response = await apiClient.get<{ items: TeamEvent[] }>('/team-events/events', {
    params: query
  });
  return response.data.items;
};

export const createAdminTeamEvent = async (input: UpsertAdminTeamEventInput): Promise<TeamEvent> => {
  const response = await apiClient.post<TeamEvent>('/team-events/admin/events', input);
  return response.data;
};

export const updateAdminTeamEvent = async (eventId: string, input: UpdateAdminTeamEventInput): Promise<TeamEvent> => {
  const response = await apiClient.patch<TeamEvent>(`/team-events/admin/events/${eventId}`, input);
  return response.data;
};
