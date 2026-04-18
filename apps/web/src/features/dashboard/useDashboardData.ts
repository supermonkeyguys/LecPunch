import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamActiveAttendanceItem, TeamWeeklyStatItem, WeeklyStatItem } from '@lecpunch/shared';
import type { WeekKey } from '@/app/store/root-store';
import {
  getCurrentAttendance,
  getTeamActiveAttendances,
  type CurrentAttendanceResponse
} from '@/features/attendance/attendance.api';
import { getMyRecords, type AttendanceRecordItem } from '@/features/records/records.api';
import { getMyWeeklyStats, getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { selectedWeekToKey } from '@/shared/lib/time';

interface DashboardData {
  attendance: CurrentAttendanceResponse | null;
  weeklyStats: WeeklyStatItem[];
  weeklyGoalSeconds: number;
  teamStats: TeamWeeklyStatItem[];
  activeMembers: TeamActiveAttendanceItem[];
  records: AttendanceRecordItem[];
}

const INITIAL_DATA: DashboardData = {
  attendance: null,
  weeklyStats: [],
  weeklyGoalSeconds: 0,
  teamStats: [],
  activeMembers: [],
  records: []
};

export const useDashboardData = (selectedWeek: WeekKey) => {
  const fetchDashboardData = useCallback(async (_signal: AbortSignal): Promise<DashboardData> => {
    const [attendance, weekly, teamStats, activeMembers, records] = await Promise.all([
      getCurrentAttendance(),
      getMyWeeklyStats(),
      getTeamCurrentWeekStats(true),
      getTeamActiveAttendances(),
      getMyRecords({ pageSize: 100 })
    ]);

    return {
      attendance,
      weeklyStats: weekly.items,
      weeklyGoalSeconds: weekly.weeklyGoalSeconds,
      teamStats,
      activeMembers,
      records
    };
  }, []);

  const { data, loading, error, refresh } = useAsyncData(fetchDashboardData, [], {
    initialData: INITIAL_DATA
  });
  const [activeMembers, setActiveMembers] = useState<TeamActiveAttendanceItem[]>(INITIAL_DATA.activeMembers);

  useEffect(() => {
    setActiveMembers(data.activeMembers);
  }, [data.activeMembers]);

  useEffect(() => {
    let cancelled = false;
    const setIntervalFn =
      typeof globalThis.setInterval === 'function' ? globalThis.setInterval : window.setInterval.bind(window);
    const clearIntervalFn =
      typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : window.clearInterval.bind(window);

    const syncActiveMembers = async () => {
      try {
        const nextActiveMembers = await getTeamActiveAttendances();
        if (!cancelled) {
          setActiveMembers(nextActiveMembers);
        }
      } catch {
        // Keep the latest successful active-members snapshot on polling failures.
      }
    };

    const interval = setIntervalFn(() => {
      void syncActiveMembers();
    }, 15000);

    return () => {
      cancelled = true;
      clearIntervalFn(interval);
    };
  }, []);

  const selectedWeekKey = useMemo(() => selectedWeekToKey(selectedWeek), [selectedWeek]);
  const selectedWeekStat = useMemo(
    () => data.weeklyStats.find((item) => item.weekKey === selectedWeekKey) ?? null,
    [selectedWeekKey, data.weeklyStats]
  );
  const selectedWeekRecords = useMemo(
    () => data.records.filter((record) => record.weekKey === selectedWeekKey),
    [selectedWeekKey, data.records]
  );

  return {
    attendance: data.attendance,
    weeklyStats: data.weeklyStats,
    weeklyGoalSeconds: data.weeklyGoalSeconds,
    teamStats: data.teamStats,
    activeMembers,
    records: data.records,
    loading,
    error: error ? getApiErrorMessage(error, '加载工作台失败，请稍后重试') : null,
    selectedWeekKey,
    selectedWeekStat,
    selectedWeekRecords,
    refresh
  };
};
