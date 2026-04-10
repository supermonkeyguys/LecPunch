import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ATTENDANCE_MAX_SECONDS, WARNING_THRESHOLD_SECONDS, type TeamWeeklyStatItem } from '@lecpunch/shared';
import { Alert, Button } from '@lecpunch/ui';
import { WeekSelector } from '@/app/components/WeekSelector';
import { useRootStore } from '@/app/store/root-store';
import { checkInAttendance, checkOutAttendance } from '@/features/attendance/attendance.api';
import { useDashboardData } from '@/features/dashboard/useDashboardData';
import { useSecondsTicker } from '@/shared/hooks/useSecondsTicker';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';
import { DashboardAttendanceWidget } from '@/widgets/dashboard/DashboardAttendanceWidget';
import { DashboardHeatmapWidget } from '@/widgets/dashboard/DashboardHeatmapWidget';
import { DashboardTeamWidget } from '@/widgets/dashboard/DashboardTeamWidget';
import { WEEK_LABELS } from '@/widgets/dashboard/dashboard.lib';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const selectedWeek = useRootStore((state) => state.selectedWeek);
  const setSelectedWeek = useRootStore((state) => state.setSelectedWeek);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const {
    attendance,
    weeklyGoalSeconds,
    teamStats,
    records,
    selectedWeekRecords,
    selectedWeekStat,
    loading,
    error,
    refresh
  } = useDashboardData(selectedWeek);

  const weekLabel = WEEK_LABELS[selectedWeek];
  const currentSession = attendance?.session ?? null;
  const isCurrentWeek = selectedWeek === 'current';
  const isCheckedIn = isCurrentWeek && (attendance?.hasActiveSession ?? false);
  const selectedWeekDuration =
    selectedWeekStat?.totalDurationSeconds ??
    selectedWeekRecords.reduce((sum, record) => sum + (record.durationSeconds ?? 0), 0);
  const selectedWeekSessionsCount = selectedWeekStat?.sessionsCount ?? selectedWeekRecords.length;

  useEffect(() => {
    setElapsedSeconds(currentSession?.elapsedSeconds ?? 0);
  }, [currentSession?.elapsedSeconds]);

  useSecondsTicker(() => {
    setElapsedSeconds((value) => value + 1);
  }, isCurrentWeek && isCheckedIn);

  const currentDuration = currentSession ? elapsedSeconds : 0;
  const isWarning = currentDuration >= WARNING_THRESHOLD_SECONDS;
  const isNearLimit = currentDuration >= ATTENDANCE_MAX_SECONDS - 360;

  const handleAttendanceAction = async () => {
    if (!isCurrentWeek) {
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      if (isCheckedIn) {
        const result = await checkOutAttendance();
        if (result.status === 'invalidated') {
          showToast('本次打卡已超过 5 小时上限，记录已作废', 'error');
        } else {
          showToast('下卡成功，辛苦了！');
        }
      } else {
        await checkInAttendance();
        showToast('上卡成功，加油！');
      }

      refresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error, '操作失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const openMemberRecords = (member: TeamWeeklyStatItem) => {
    navigate(`/members/${member.userId}/records`, {
      state: { displayName: member.displayName, role: member.role }
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      {actionError ? (
        <Alert
          variant="error"
          icon={<AlertTriangle className="h-4 w-4" />}
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      ) : null}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="mt-1 text-sm text-gray-500">
            当前显示：
            <span className="font-medium text-blue-600">{weekLabel}</span> 的数据
          </p>
        </div>
        <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
      </div>

      {!isCurrentWeek ? (
        <Alert variant="info" icon={<AlertTriangle className="h-4 w-4" />}>
          当前正在查看 {weekLabel} 的个人数据。打卡按钮已禁用，团队榜固定展示本周同年级排行。
        </Alert>
      ) : null}

      {error ? (
        <PageSection>
          <PageState
            tone="error"
            title={error}
            description="请检查网络后重新加载工作台数据。"
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                重新加载
              </Button>
            }
          />
        </PageSection>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <DashboardAttendanceWidget
              loading={loading}
              weekLabel={weekLabel}
              isCurrentWeek={isCurrentWeek}
              isCheckedIn={isCheckedIn}
              currentDuration={currentDuration}
              selectedWeekDuration={selectedWeekDuration}
              selectedWeekSessionsCount={selectedWeekSessionsCount}
              weeklyGoalSeconds={weeklyGoalSeconds}
              submitting={submitting}
              isWarning={isWarning}
              isNearLimit={isNearLimit}
              onAction={handleAttendanceAction}
            />
            <DashboardHeatmapWidget loading={loading} records={records} />
          </div>

          <DashboardTeamWidget
            loading={loading}
            teamStats={teamStats}
            isCurrentWeek={isCurrentWeek}
            onOpenMember={openMemberRecords}
            onOpenMembers={() => navigate('/members')}
          />
        </div>
      )}
    </div>
  );
};
