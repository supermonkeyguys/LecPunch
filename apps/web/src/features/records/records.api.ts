import { apiClient } from '@/shared/http/api-client';
import type { AttendanceSession } from '@lecpunch/shared';

export interface RecordFilters {
  weekKey?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export type AttendanceRecordItem = Pick<
  AttendanceSession,
  'id' | 'checkInAt' | 'checkOutAt' | 'durationSeconds' | 'status' | 'invalidReason' | 'weekKey'
>;

export const getMyRecords = async (filters?: RecordFilters) => {
  const response = await apiClient.get<{ items: AttendanceRecordItem[]; page: number; pageSize: number }>('/records/me', {
    params: filters ?? undefined
  });
  return response.data.items;
};

export const getMemberRecords = async (memberKey: string, filters?: RecordFilters) => {
  const response = await apiClient.get<{ items: AttendanceRecordItem[]; page: number; pageSize: number }>(
    `/records/member/${memberKey}`,
    {
      params: filters ?? undefined
    }
  );
  return response.data.items;
};

export interface AdminRecordsExportResult {
  blob: Blob;
  filename: string;
}

const parseFilenameFromDisposition = (disposition?: string) => {
  if (!disposition) {
    return 'team-records-all.csv';
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? 'team-records-all.csv';
};

export const downloadAdminRecordsExport = async (filters?: RecordFilters): Promise<AdminRecordsExportResult> => {
  const response = await apiClient.get<Blob>('/records/admin/export', {
    params: filters ?? undefined,
    responseType: 'blob'
  });

  return {
    blob: response.data,
    filename: parseFilenameFromDisposition(response.headers['content-disposition'])
  };
};
