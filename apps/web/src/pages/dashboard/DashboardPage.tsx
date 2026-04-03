import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/shared/ui/card';
import { formatDuration } from '@/shared/lib/time';
import { useSecondsTicker } from '@/shared/hooks/useSecondsTicker';
import { DESIGN_TOKENS } from '@/shared/constants/design-tokens';
import {
  checkInAttendance,
  checkOutAttendance,
  getCurrentAttendance,
  type CurrentAttendanceResponse
} from '@/features/attendance/attendance.api';
import { getMyWeeklyStats, getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import type { TeamWeeklyStatItem, WeeklyStatItem } from '@lecpunch/shared';

export const DashboardPage = () => {
  const [attendance, setAttendance] = useState<CurrentAttendanceResponse | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [teamStats, setTeamStats] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const currentSession = attendance?.session ?? null;
  const isCheckedIn = attendance?.hasActiveSession ?? false;

  useEffect(() => {
    setElapsedSeconds(currentSession?.elapsedSeconds ?? 0);
  }, [currentSession?.elapsedSeconds]);

  useSecondsTicker(() => {
    setElapsedSeconds((value) => value + 1);
  }, isCheckedIn);

  const currentDuration = useMemo(() => {
    if (!currentSession) {
      return 0;
    }
    return elapsedSeconds;
  }, [currentSession, elapsedSeconds]);

  const warningMessage = useMemo(() => {
    if (!isCheckedIn) {
      return null;
    }
    if (currentDuration >= DESIGN_TOKENS.time.maxSeconds - 360) {
      return '即将达到 5 小时上限，请尽快下卡';
    }
    if (currentDuration >= DESIGN_TOKENS.time.warningSeconds) {
      return '接近 5 小时上限，请注意打卡时长';
    }
    return null;
  }, [currentDuration, isCheckedIn]);

  const latestWeeklyStat = weeklyStats[0] ?? null;

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [current, weekly, team] = await Promise.all([
        getCurrentAttendance(),
        getMyWeeklyStats(),
        getTeamCurrentWeekStats()
      ]);
      setAttendance(current);
      setWeeklyStats(weekly);
      setTeamStats(team);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleAttendanceAction = async () => {
    setSubmitting(true);
    try {
      if (isCheckedIn) {
        await checkOutAttendance();
      } else {
        await checkInAttendance();
      }
      await loadDashboard();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">当前打卡状态</h2>
          <p className="mt-3 text-sm text-slate-500">
            {loading ? '正在加载当前状态...' : isCheckedIn ? '当前正在打卡中' : '当前未在打卡中'}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatDuration(currentDuration)}</p>
          {warningMessage ? <p className="mt-3 text-sm text-amber-600">{warningMessage}</p> : null}
          <button
            type="button"
            disabled={loading || submitting}
            onClick={handleAttendanceAction}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? '提交中...' : isCheckedIn ? '下卡' : '上卡'}
          </button>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">本周统计</h2>
          {latestWeeklyStat ? (
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>累计时长：{formatDuration(latestWeeklyStat.totalDurationSeconds)}</p>
              <p>打卡次数：{latestWeeklyStat.sessionsCount}</p>
              <p>周标识：{latestWeeklyStat.weekKey}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">暂无本周统计数据</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">团队概览</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {teamStats.length > 0 ? (
              teamStats.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-900">{member.displayName}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{formatDuration(member.totalDurationSeconds)}</p>
                    <p className="text-xs text-slate-500">{member.sessionsCount} 次</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">暂无团队统计数据</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
