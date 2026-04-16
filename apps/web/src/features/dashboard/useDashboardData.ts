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
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { selectedWeekToKey } from '@/shared/lib/time';

interface DashboardState {
  attendance: CurrentAttendanceResponse | null;
  weeklyStats: WeeklyStatItem[];
  weeklyGoalSeconds: number;
  teamStats: TeamWeeklyStatItem[];
  activeMembers: TeamActiveAttendanceItem[];
  records: AttendanceRecordItem[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: DashboardState = {
  attendance: null,
  weeklyStats: [],
  weeklyGoalSeconds: 0,
  teamStats: [],
  activeMembers: [],
  records: [],
  loading: true,
  error: null
};

export const useDashboardData = (selectedWeek: WeekKey) => {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const [attendance, weekly, teamStats, activeMembers, records] = await Promise.all([
          getCurrentAttendance(),
          getMyWeeklyStats(),
          getTeamCurrentWeekStats(true),
          getTeamActiveAttendances(),
          getMyRecords({ pageSize: 100 })
        ]);

        if (cancelled) {
          return;
        }

        setState({
          attendance,
          weeklyStats: weekly.items,
          weeklyGoalSeconds: weekly.weeklyGoalSeconds,
          teamStats,
          activeMembers,
          records,
          loading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          error: getApiErrorMessage(error, '加载工作台失败，请稍后重试')
        }));
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    const setIntervalFn =
      typeof globalThis.setInterval === 'function' ? globalThis.setInterval : window.setInterval.bind(window);
    const clearIntervalFn =
      typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : window.clearInterval.bind(window);

    const syncActiveMembers = async () => {
      try {
        const activeMembers = await getTeamActiveAttendances();
        if (!cancelled) {
          setState((current) => ({ ...current, activeMembers }));
        }
      } catch {
        if (!cancelled) {
          setState((current) => current);
        }
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
    () => state.weeklyStats.find((item) => item.weekKey === selectedWeekKey) ?? null,
    [selectedWeekKey, state.weeklyStats]
  );
  const selectedWeekRecords = useMemo(
    () => state.records.filter((record) => record.weekKey === selectedWeekKey),
    [selectedWeekKey, state.records]
  );

  return {
    ...state,
    selectedWeekKey,
    selectedWeekStat,
    selectedWeekRecords,
    refresh
  };
};
