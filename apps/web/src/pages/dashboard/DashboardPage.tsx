import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BellRing, Clock3 } from 'lucide-react';
import {
  ATTENDANCE_KEEPALIVE_INTERVAL_SECONDS,
  ATTENDANCE_KEEPALIVE_TIMEOUT_SECONDS,
  ATTENDANCE_MAX_SECONDS,
  ERROR_CODES,
  WARNING_THRESHOLD_SECONDS,
  type AttendancePauseReason,
  type TeamActiveAttendanceItem,
  type TeamWeeklyStatItem
} from '@lecpunch/shared';
import { Alert, Badge, Button } from '@lecpunch/ui';
import { WeekSelector } from '@/app/components/WeekSelector';
import { useRootStore } from '@/app/store/root-store';
import { checkInAttendance, checkOutAttendance, keepAliveAttendance } from '@/features/attendance/attendance.api';
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

const KEEPALIVE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
export const DashboardPage = () => {
  const navigate = useNavigate();
  const selectedWeek = useRootStore((state) => state.selectedWeek);
  const setSelectedWeek = useRootStore((state) => state.setSelectedWeek);
  const token = useRootStore((state) => state.auth.token);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creditedSeconds, setCreditedSeconds] = useState(0);
  const [liveSliceSeconds, setLiveSliceSeconds] = useState(0);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<AttendancePauseReason | undefined>(undefined);
  const [lastKeepaliveSyncAtMs, setLastKeepaliveSyncAtMs] = useState<number | null>(null);
  const [keepaliveNotice, setKeepaliveNotice] = useState<string | null>(null);
  const keepaliveInFlightRef = useRef(false);

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
  const selectedWeekSessionsCount = selectedWeekStat?.sessionsCount ?? selectedWeekRecords.length;

  useEffect(() => {
    const nextCreditedSeconds = currentSession?.creditedSeconds ?? 0;
    const nextPaused = Boolean(currentSession?.isPaused);
    const serverElapsedSeconds = currentSession?.elapsedSeconds ?? nextCreditedSeconds;
    const nextLiveSliceSeconds = nextPaused ? 0 : Math.max(0, serverElapsedSeconds - nextCreditedSeconds);

    setCreditedSeconds(nextCreditedSeconds);
    setLiveSliceSeconds(nextLiveSliceSeconds);
    setSessionPaused(nextPaused);
    setPauseReason(currentSession?.pauseReason as AttendancePauseReason | undefined);
    setKeepaliveNotice(null);
    if (currentSession) {
      const syncAt = currentSession.lastKeepaliveAt ? new Date(currentSession.lastKeepaliveAt).getTime() : Date.now();
      setLastKeepaliveSyncAtMs(syncAt);
    } else {
      setLastKeepaliveSyncAtMs(null);
    }
  }, [
    currentSession?.id,
    currentSession?.creditedSeconds,
    currentSession?.elapsedSeconds,
    currentSession?.isPaused,
    currentSession?.pauseReason
  ]);

  useSecondsTicker(() => {
    const now = Date.now();
    const timeoutMs = ATTENDANCE_KEEPALIVE_TIMEOUT_SECONDS * 1000;
    if (lastKeepaliveSyncAtMs !== null && now - lastKeepaliveSyncAtMs > timeoutMs) {
      setSessionPaused(true);
      setPauseReason('heartbeat_timeout');
      setActionError((current) => current ?? '续记账中断，已暂停累计，请检查网络后重试。');
      return;
    }

    setLiveSliceSeconds((value) => value + 1);
  }, isCurrentWeek && isCheckedIn && !sessionPaused);

  useEffect(() => {
    if (!isCurrentWeek || !isCheckedIn) {
      return;
    }

    let cancelled = false;
    const setIntervalFn =
      typeof globalThis.setInterval === 'function' ? globalThis.setInterval : window.setInterval.bind(window);
    const clearIntervalFn =
      typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : window.clearInterval.bind(window);

    const waitFor = async (ms: number) =>
      new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, ms);

        if (cancelled) {
          clearTimeout(timeout);
          resolve();
        }
      });

    const handleKeepaliveTerminalError = (error: unknown, errorCode?: string) => {
      const resolvedErrorCode = errorCode ?? getApiErrorCode(error);

      if (resolvedErrorCode === ERROR_CODES.ATTENDANCE_SESSION_INVALIDATED) {
        setActionError(getApiErrorMessage(error, '当前打卡已失效，请重新上卡'));
        refresh();
        return;
      }

      if (resolvedErrorCode === ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED) {
        setSessionPaused(true);
        setPauseReason('network_not_allowed');
        setLiveSliceSeconds(0);
        setActionError('当前网络不在允许范围内，已暂停累计，请切换网络后重试。');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setSessionPaused(true);
        setPauseReason('client_offline');
        setLiveSliceSeconds(0);
        setActionError('当前设备离线，已暂停累计，恢复联网后会继续。');
        return;
      }

      setSessionPaused(true);
      setPauseReason('heartbeat_timeout');
      setActionError(getApiErrorMessage(error, '续记账失败，已暂停累计，请检查网络后重试。'));
    };

    const syncKeepAlive = async () => {
      if (keepaliveInFlightRef.current) {
        return;
      }

      keepaliveInFlightRef.current = true;

      try {
        for (let attempt = 0; attempt <= KEEPALIVE_RETRY_DELAYS_MS.length; attempt += 1) {
          if (cancelled) {
            return;
          }

          if (attempt > 0) {
            setKeepaliveNotice(`网络波动，正在尝试恢复连接（${attempt}/${KEEPALIVE_RETRY_DELAYS_MS.length}）...`);
            await waitFor(KEEPALIVE_RETRY_DELAYS_MS[attempt - 1]);
            if (cancelled) {
              return;
            }
          }

          try {
            const keepalive = await keepAliveAttendance();
            if (cancelled) {
              return;
            }

            const nextCreditedSeconds = keepalive?.creditedSeconds ?? 0;
            const nextPaused = Boolean(keepalive?.isPaused);
            setCreditedSeconds(nextCreditedSeconds);
            setLiveSliceSeconds(0);
            setSessionPaused(nextPaused);
            setPauseReason(keepalive?.pauseReason as AttendancePauseReason | undefined);
            setLastKeepaliveSyncAtMs(
              keepalive?.lastKeepaliveAt ? new Date(keepalive.lastKeepaliveAt).getTime() : Date.now()
            );
            setKeepaliveNotice(null);

            if (!nextPaused) {
              setActionError((current) => (current?.includes('暂停累计') ? null : current));
            }

            return;
          } catch (error) {
            if (cancelled) {
              return;
            }

            const errorCode = getApiErrorCode(error);
            const shouldRetry =
              errorCode !== ERROR_CODES.ATTENDANCE_SESSION_INVALIDATED &&
              errorCode !== ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED &&
              attempt < KEEPALIVE_RETRY_DELAYS_MS.length;

            if (shouldRetry) {
              continue;
            }

            setKeepaliveNotice(null);
            handleKeepaliveTerminalError(error, errorCode);
            return;
          }
        }
      } finally {
        keepaliveInFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncKeepAlive();
      }
    };

    const interval = setIntervalFn(() => {
      void syncKeepAlive();
    }, ATTENDANCE_KEEPALIVE_INTERVAL_SECONDS * 1000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      clearIntervalFn(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isCheckedIn, isCurrentWeek, refresh]);

  const currentDuration = currentSession ? creditedSeconds + (sessionPaused ? 0 : liveSliceSeconds) : 0;
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
          const durationText = formatDuration(result.durationSeconds ?? 0);
          showToast(`下卡成功，本次有效时长 ${durationText}。`);
        }
      } else {
        await checkInAttendance();
        showToast('上卡成功，继续加油。');
      }

      refresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error, '操作失败，请稍后重试'));
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
      isCheckedIn,
      isPaused: sessionPaused,
      pauseReason,
      currentDuration,
      selectedWeekDuration,
      selectedWeekSessionsCount,
      weeklyGoalSeconds,
      submitting,
      isWarning,
      isNearLimit,
      onAttendanceAction: handleAttendanceAction,
    }),
    [
      loading,
      weekLabel,
      isCurrentWeek,
      isCheckedIn,
      sessionPaused,
      pauseReason,
      currentDuration,
      selectedWeekDuration,
      selectedWeekSessionsCount,
      weeklyGoalSeconds,
      submitting,
      isWarning,
      isNearLimit,
      handleAttendanceAction,
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

      {keepaliveNotice ? (
        <Alert variant="info" icon={<Clock3 className="h-4 w-4" />}>
          {keepaliveNotice}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <DashboardContextProvider value={dashboardContextValue}>
                <DashboardAttendanceWidget />
              </DashboardContextProvider>
              <DashboardHeatmapWidget loading={loading} records={records} />
            </div>

            <DashboardTeamWidget
              loading={loading}
              teamStats={teamStats}
              isCurrentWeek={isCurrentWeek}
              onOpenMember={openMemberRecords}
              onOpenMembers={() => navigate('/members', { state: { scope: 'same-grade' } })}
            />
          </div>

          <DashboardActiveMembersWidget
            loading={loading}
            activeMembers={activeMembers}
            onOpenMember={openActiveMemberRecords}
          />
        </div>
      )}
    </div>
  );
};
