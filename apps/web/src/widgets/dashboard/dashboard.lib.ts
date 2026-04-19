import type { AttendanceRecordItem } from '@/features/records/records.api';
import type { WeekKey } from '@/app/store/ui-store';

export const HEATMAP_WEEKS = 20;

export const WEEK_LABELS: Record<WeekKey, string> = {
  current: '本周',
  prev1: '上周',
  prev2: '前两周',
  prev3: '前三周'
};

export interface HeatmapCell {
  count: number;
  totalSeconds: number;
}

export const buildHeatmap = (records: AttendanceRecordItem[]) => {
  const map = new Map<string, HeatmapCell>();
  for (const record of records) {
    if (record.status === 'active') {
      continue;
    }

    const date = new Date(record.checkInAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    const previous = map.get(key) ?? { count: 0, totalSeconds: 0 };

    map.set(key, {
      count: previous.count + 1,
      totalSeconds: previous.totalSeconds + (record.durationSeconds ?? 0)
    });
  }

  return map;
};

export const getMonday = () => {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const cellDate = (todayMonday: Date, weekIndex: number, dayIndex: number) => {
  const date = new Date(todayMonday);
  date.setDate(date.getDate() - (HEATMAP_WEEKS - 1 - weekIndex) * 7 + dayIndex);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};
