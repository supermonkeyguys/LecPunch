import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BellRing, Clock3 } from 'lucide-react';
import {
  ATTENDANCE_MAX_SECONDS,
  ERROR_CODES,
  WARNING_THRESHOLD_SECONDS,
  type TeamActiveAttendanceItem,
  type TeamWeeklyStatItem
} from '@lecpunch/shared';
import { Alert, Badge, Button } from '@lecpunch/ui';
import { WeekSelector } from '@/app/components/WeekSelector';
import { useAuthStore } from '@/app/store/auth-store';
import { useUIStore } from '@/app/store/ui-store';
import { checkInAttendance, checkOutAttendance } from '@/features/attendance/attendance.api';
import { DashboardContextProvider } from '@/features/dashboard/context/DashboardContext';
import { useDashboardData } from '@/features/dashboard/useDashboardData';
import { useDashboardNotifications } from '@/features/notifications/useDashboardNotifications';
import { useSecondsTicker } from '@/shared/hooks/useSecondsTicker';
import { getApiErrorCode, getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime, formatDuration, formatWeekRangeLabel } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';
import { DashboardActiveMembersWidget } from '@/widgets/dashboard/DashboardActiveMembersWidget';
import { DashboardAttendanceWidget } from '@/widgets/dashboard/DashboardAttendanceWidget';
import { DashboardHeatmapWidget } from '@/widgets/dashboard/DashboardHeatmapWidget';
import { DashboardTeamWidget } from '@/widgets/dashboard/DashboardTeamWidget';
import { WEEK_LABELS } from '@/widgets/dashboard/dashboard.lib';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const selectedWeek = useUIStore((state) => state.selectedWeek);
  const setSelectedWeek = useUIStore((state) => state.setSelectedWeek);
  const token = useAuthStore((state) => state.auth.token);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);

  const {
    attendance,
    weeklyGoalSeconds,
    teamStats,
    activeMembers,
    records,
    selectedWeekRecords,
    selectedWeekStat,
    loading,
    error,
    refresh
  } = useDashboardData(selectedWeek);
  const {
    notifications,
    error: notificationError,
    pendingIds,
    acknowledge
  } = useDashboardNotifications(token);

  const weekLabel = WEEK_LABELS[selectedWeek];
  const currentSession = attendance?.session ?? null;
  const isCurrentWeek = selectedWeek === 'current';
  const isCheckedIn = isCurrentWeek && (attendance?.hasActiveSession ?? false);
  const selectedWeekDuration =
    selectedWeekStat?.totalDurationSeconds ??
    selectedWeekRecords.reduce((sum, record) => sum + (record.durationSeconds ?? 0), 0);
  const selectedWeekRecordedDuration =
    selectedWeekStat?.recordedDurationSeconds ??
    selectedWeekRecords.reduce((sum, record) => sum + (record.durationSeconds ?? 0), 0);
  const selectedWeekManualAdjustment = selectedWeekStat?.manualAdjustmentSeconds ?? 0;
  const selectedWeekAdjustmentsCount = selectedWeekStat?.adjustmentsCount ?? 0;
  const selectedWeekSessionsCount = selectedWeekStat?.sessionsCount ?? selectedWeekRecords.length;

  useEffect(() => {
    setLiveElapsedSeconds(currentSession?.elapsedSeconds ?? 0);
  }, [currentSession?.id, currentSession?.elapsedSeconds]);

  useSecondsTicker(() => setLiveElapsedSeconds((value) => value + 1), isCurrentWeek && isCheckedIn);

  useEffect(() => {
    if (!isCurrentWeek || !isCheckedIn) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [isCheckedIn, isCurrentWeek, refresh]);

  const currentDuration = currentSession ? liveElapsedSeconds : 0;
  const isWarning = currentDuration >= WARNING_THRESHOLD_SECONDS;
  const isNearLimit = currentDuration >= WARNING_THRESHOLD_SECONDS;

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
          const durationText = formatDuration(result.durationSeconds ?? 0);
          showToast(`下卡成功，本次有效时长 ${durationText}。`);
        }
      } else {
        await checkInAttendance();
        showToast('上卡成功，继续加油。');
      }

      refresh();
    } catch (error) {
      const errorCode = getApiErrorCode(error);
      if (
        errorCode === ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN ||
        errorCode === ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION
      ) {
        refresh();
        setActionError('打卡状态已在其他页面或设备发生变化，已开始同步最新状态。');
      } else {
        setActionError(getApiErrorMessage(error, '操作失败，请稍后重试'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openMemberRecords = (member: TeamWeeklyStatItem) => {
    navigate(`/members/${member.memberKey}/records`, {
      state: { displayName: member.displayName }
    });
  };

  const openActiveMemberRecords = (member: TeamActiveAttendanceItem) => {
    navigate(`/members/${member.memberKey}/records`, {
      state: { displayName: member.displayName }
    });
  };

  const handleAcknowledgeNotification = async (notificationId: string) => {
    await acknowledge(notificationId);
  };

  const handleOpenRecords = async (notificationId: string) => {
    const confirmed = await acknowledge(notificationId);
    if (confirmed) {
      navigate('/records');
    }
  };

  const dashboardContextValue = useMemo(
    () => ({
      loading,
      weekLabel,
      isCurrentWeek,
      teamStats,
      activeMembers,
      records,
      isCheckedIn,
      currentDuration,
      selectedWeekDuration,
      selectedWeekRecordedDuration,
      selectedWeekManualAdjustment,
      selectedWeekAdjustmentsCount,
      selectedWeekSessionsCount,
      weeklyGoalSeconds,
      submitting,
      isWarning,
      isNearLimit,
      onAttendanceAction: handleAttendanceAction,
      onOpenMember: openMemberRecords,
      onOpenActiveMember: openActiveMemberRecords,
      onOpenMembers: () => navigate('/members', { state: { scope: 'same-grade' } }),
    }),
    [
      loading,
      weekLabel,
      isCurrentWeek,
      teamStats,
      activeMembers,
      records,
      isCheckedIn,
      currentDuration,
      selectedWeekDuration,
      selectedWeekRecordedDuration,
      selectedWeekManualAdjustment,
      selectedWeekAdjustmentsCount,
      selectedWeekSessionsCount,
      weeklyGoalSeconds,
      submitting,
      isWarning,
      isNearLimit,
      handleAttendanceAction,
      openMemberRecords,
      openActiveMemberRecords,
      navigate,
    ]
  );

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

      {notificationError ? (
        <Alert variant="error" icon={<AlertTriangle className="h-4 w-4" />}>
          {notificationError}
        </Alert>
      ) : null}

      {notifications.length > 0 ? (
        <PageSection padded className="border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">待确认通知</h2>
                    <Badge variant="warning">{notifications.length}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{notification.title}</p>
                        <Badge variant="warning">待处理</Badge>
                      </div>
                      <p className="text-sm leading-6 text-gray-700">{notification.message}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(notification.createdAt)}
                        </span>
                        {notification.type === 'attendance.record_marked' ? (
                          <span>关联周：{formatWeekRangeLabel(notification.payload.weekKey)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={pendingIds.includes(notification.id)}
                        onClick={() => void handleAcknowledgeNotification(notification.id)}
                      >
                        知道了
                      </Button>
                      <Button
                        size="sm"
                        loading={pendingIds.includes(notification.id)}
                        onClick={() => void handleOpenRecords(notification.id)}
                      >
                        查看记录
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PageSection>
      ) : null}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
        </div>
        <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
      </div>

      {!isCurrentWeek ? (
        <Alert variant="info" icon={<AlertTriangle className="h-4 w-4" />}>
          当前查看 {weekLabel}，不可打卡。
        </Alert>
      ) : null}

      {error ? (
        <PageSection>
          <PageState
            tone="error"
            title={error}
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                重新加载
              </Button>
            }
          />
        </PageSection>
      ) : (
        <DashboardContextProvider value={dashboardContextValue}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <DashboardAttendanceWidget />
                <DashboardHeatmapWidget />
              </div>

              <DashboardTeamWidget />
            </div>

            <DashboardActiveMembersWidget />
          </div>
        </DashboardContextProvider>
      )}
    </div>
  );
};
