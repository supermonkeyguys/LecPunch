import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, AlertTriangle, History, Users } from 'lucide-react';
import { Alert, Avatar, Button, Progress } from '@lecpunch/ui';
import { formatDuration } from '@/shared/lib/time';
import { showToast } from '@/shared/ui/toast';
import { useSecondsTicker } from '@/shared/hooks/useSecondsTicker';
import { DESIGN_TOKENS } from '@/shared/constants/design-tokens';
import { WeekSelector } from '@/app/components/WeekSelector';
import { useRootStore } from '@/app/store/root-store';
import {
  checkInAttendance,
  checkOutAttendance,
  getCurrentAttendance,
  type CurrentAttendanceResponse
} from '@/features/attendance/attendance.api';
import { getMyWeeklyStats, getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import { getMyRecords } from '@/features/records/records.api';
import type { AttendanceSession, TeamWeeklyStatItem, WeeklyStatItem } from '@lecpunch/shared';

const HEATMAP_WEEKS = 20;

interface HeatmapCell { count: number; totalSeconds: number }

/** Build a map of dateStr → { count, totalSeconds } from records */
function buildHeatmap(records: AttendanceSession[]): Map<string, HeatmapCell> {
  const map = new Map<string, HeatmapCell>();
  for (const r of records) {
    if (r.status === 'active') continue;
    const d = new Date(r.checkInAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const prev = map.get(key) ?? { count: 0, totalSeconds: 0 };
    map.set(key, { count: prev.count + 1, totalSeconds: prev.totalSeconds + (r.durationSeconds ?? 0) });
  }
  return map;
}

/** Get the date string for a cell in the heatmap grid (weekIdx=0 is oldest) */
function cellDate(todayMonday: Date, weekIdx: number, dayIdx: number): string {
  const d = new Date(todayMonday);
  // weekIdx=0 is the oldest week (HEATMAP_WEEKS-1 weeks ago)
  d.setDate(d.getDate() - (HEATMAP_WEEKS - 1 - weekIdx) * 7 + dayIdx);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get this week's Monday */
function getMonday(): Date {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export const DashboardPage = () => {
  const navigate = useNavigate();
  const selectedWeek = useRootStore((s) => s.selectedWeek);
  const setSelectedWeek = useRootStore((s) => s.setSelectedWeek);

  const [attendance, setAttendance] = useState<CurrentAttendanceResponse | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [weeklyGoalSeconds, setWeeklyGoalSeconds] = useState(0);
  const [teamStats, setTeamStats] = useState<TeamWeeklyStatItem[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceSession[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ dateStr: string; cell: HeatmapCell; x: number; y: number; flip: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const currentSession = attendance?.session ?? null;
  const isCheckedIn = attendance?.hasActiveSession ?? false;
  const isCurrentWeek = selectedWeek === 'current';

  useEffect(() => {
    setElapsedSeconds(currentSession?.elapsedSeconds ?? 0);
  }, [currentSession?.elapsedSeconds]);

  useSecondsTicker(() => {
    setElapsedSeconds((v) => v + 1);
  }, isCheckedIn);

  const currentDuration = useMemo(() => {
    if (!currentSession) return 0;
    return elapsedSeconds;
  }, [currentSession, elapsedSeconds]);

  const progressPercent = Math.min((currentDuration / DESIGN_TOKENS.time.maxSeconds) * 100, 100);
  const isWarning = currentDuration >= DESIGN_TOKENS.time.warningSeconds;
  const isNearLimit = currentDuration >= DESIGN_TOKENS.time.maxSeconds - 360;

  const latestWeeklyStat = weeklyStats[0] ?? null;

  // Heatmap derived from real records
  const heatmapMap = useMemo(() => buildHeatmap(allRecords), [allRecords]);
  const todayMonday = useMemo(() => getMonday(), []);

  const totalHours = useMemo(() => {
    const total = allRecords.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
    return Math.floor(total / 3600);
  }, [allRecords]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [current, weekly, team, records] = await Promise.all([
        getCurrentAttendance(),
        getMyWeeklyStats(),
        getTeamCurrentWeekStats(true),
        getMyRecords()
      ]);
      setAttendance(current);
      setWeeklyStats(weekly.items);
      setWeeklyGoalSeconds(weekly.weeklyGoalSeconds);
      setTeamStats(team);
      setAllRecords(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleAttendanceAction = async () => {
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
      await loadDashboard();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const msgMap: Record<string, string> = {
        ATTENDANCE_NETWORK_NOT_ALLOWED: '当前网络不在允许范围内，无法打卡',
        ATTENDANCE_ALREADY_CHECKED_IN: '您已有进行中的打卡，请勿重复上卡',
        ATTENDANCE_NO_ACTIVE_SESSION: '当前没有进行中的打卡',
      };
      setActionError(msgMap[code] ?? err?.response?.data?.message ?? '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Action error banner */}
      {actionError ? (
        <Alert
          variant="error"
          icon={<AlertTriangle className="w-4 h-4" />}
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      ) : null}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="text-gray-500 text-sm mt-1">
            当前显示：
            <span className="font-medium text-blue-600">
              {selectedWeek === 'current' ? '本周' : selectedWeek === 'prev1' ? '上周' : selectedWeek === 'prev2' ? '前两周' : '前三周'}
            </span>{' '}
            的数据
          </p>
        </div>
        <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Main Check-in Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            {isCheckedIn && (
              <div className={`absolute top-0 left-0 w-1 h-full ${isWarning ? 'bg-red-500' : 'bg-blue-500'}`} />
            )}

            <div className="flex-1 text-center md:text-left">
              <h3 className="text-gray-500 font-medium mb-2">
                {loading
                  ? '正在加载...'
                  : isCheckedIn
                    ? '正在记录专注时长...'
                    : isCurrentWeek
                      ? '当前未打卡，开始今天的努力吧！'
                      : '查看历史周数据中'}
              </h3>
              <div
                className={`text-6xl font-mono font-bold tracking-tight mb-4 ${
                  isCheckedIn ? 'text-gray-900' : 'text-gray-300'
                }`}
              >
                {formatDuration(currentDuration)}
              </div>

              {/* 本周打卡进度 */}
              {weeklyGoalSeconds > 0 && latestWeeklyStat ? (
                <div className="max-w-md mt-1 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  {(() => {
                    const done = latestWeeklyStat.totalDurationSeconds + (isCheckedIn ? currentDuration : 0);
                    const pct = Math.min((done / weeklyGoalSeconds) * 100, 100);
                    const goalH = weeklyGoalSeconds / 3600;
                    const remainSec = Math.max(weeklyGoalSeconds - done, 0);
                    const remainH = Math.floor(remainSec / 3600);
                    const remainM = Math.floor((remainSec % 3600) / 60);
                    const reached = done >= weeklyGoalSeconds;
                    return (
                      <>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-gray-500 font-medium">本周目标 {goalH}h</span>
                          <span className={reached ? 'text-green-600 font-bold' : 'text-blue-600 font-medium'}>
                            {reached ? '✓ 已达标' : `还差 ${remainH > 0 ? `${remainH}h ` : ''}${remainM}m`}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          variant={reached ? 'default' : pct >= 80 ? 'warning' : 'default'}
                        />
                        <p className="text-xs text-gray-400 mt-1.5">
                          已完成 {formatDuration(done)} / {goalH}h
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : null}

              {isCheckedIn && (
                <div className="max-w-md">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">单次有效时长（上限 5 小时）</span>
                    <span className={isWarning ? 'text-red-600 font-bold' : 'text-blue-600 font-medium'}>
                      {Math.floor(progressPercent)}%
                    </span>
                  </div>
                  <Progress
                    value={progressPercent}
                    variant={isNearLimit ? 'danger' : isWarning ? 'warning' : 'default'}
                  />
                  {isWarning && (
                    <p className="text-sm text-red-600 mt-2 flex items-center bg-red-50 p-2 rounded-md">
                      <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                      {isNearLimit
                        ? '警告：即将超过 5 小时上限，请及时下卡！'
                        : '接近 5 小时上限，请注意打卡时长'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="flex-shrink-0">
              {isCurrentWeek ? (
                <button
                  onClick={handleAttendanceAction}
                  disabled={loading || submitting}
                  className={`w-40 h-40 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isCheckedIn
                      ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200/50 animate-pulse-slow'
                      : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-200/50 hover:shadow-blue-300/50'
                  }`}
                >
                  {isCheckedIn ? (
                    <Square className="w-10 h-10 mb-2 fill-current" />
                  ) : (
                    <Play className="w-10 h-10 mb-2 ml-1 fill-current" />
                  )}
                  <span className="font-bold text-xl tracking-widest">
                    {submitting ? '...' : isCheckedIn ? '下卡' : '上卡'}
                  </span>
                </button>
              ) : (
                <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center bg-gray-50 border-4 border-dashed border-gray-200 text-gray-400">
                  <History className="w-8 h-8 mb-2 opacity-50" />
                  <span className="font-medium text-sm text-center px-4">历史周<br />不可打卡</span>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center">
                <History className="w-5 h-5 mr-2 text-gray-400" />
                近期打卡活跃度
              </h3>
              <div className="text-sm text-gray-500">
                累计：<span className="font-bold text-gray-900">{totalHours}</span> 小时
              </div>
            </div>
            <div className="overflow-x-auto pb-2 mt-2">
              <div className="relative inline-grid min-w-max" style={{ gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'auto', gap: 6 }}>
                {/* Weekday labels — col 1, rows 1-7 */}
                {['一','二','三','四','五','六','日'].map((d, i) => (
                  <div
                    key={d}
                    className="text-xs text-gray-400 pr-3 flex items-center"
                    style={{ gridRow: i + 1, gridColumn: 1 }}
                  >
                    {d}
                  </div>
                ))}
                {/* Week columns — col 2 onwards */}
                {Array.from({ length: HEATMAP_WEEKS }).map((_, weekIdx) => (
                  Array.from({ length: 7 }).map((_, dayIdx) => {
                        const dateStr = cellDate(todayMonday, weekIdx, dayIdx);
                        const cell = heatmapMap.get(dateStr) ?? { count: 0, totalSeconds: 0 };
                        const colorClass =
                          cell.count === 0
                            ? 'bg-gray-100'
                            : cell.count === 1
                              ? 'bg-blue-200'
                              : cell.count === 2
                                ? 'bg-blue-400'
                                : 'bg-blue-600';
                        return (
                          <div
                            key={`${weekIdx}-${dayIdx}`}
                            className={`w-4 h-4 rounded-[3px] ${colorClass} hover:ring-2 hover:ring-blue-400 hover:scale-125 transition-transform cursor-pointer`}
                            style={{ gridRow: dayIdx + 1, gridColumn: weekIdx + 2 }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              // flip down if not enough space above for popover (~60px)
                              const flip = rect.top < 60;
                              setHoveredCell({
                                dateStr,
                                cell,
                                x: rect.left + rect.width / 2,
                                y: flip ? rect.bottom : rect.top,
                                flip,
                              });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                          />
                        );
                      })
                  ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-3 justify-end text-xs text-gray-400">
              <span>少</span>
              {['bg-gray-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'].map((c) => (
                <div key={c} className={`w-4 h-4 rounded-[3px] ${c}`} />
              ))}
              <span>多</span>
            </div>
            {/* Popover — fixed so it escapes overflow:hidden ancestors */}
            {hoveredCell && (
              <div
                className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap"
                style={{
                  left: hoveredCell.x,
                  top: hoveredCell.flip ? hoveredCell.y + 8 : hoveredCell.y - 8,
                  transform: hoveredCell.flip ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                }}
              >
                <div className="font-medium">{hoveredCell.dateStr}</div>
                <div className="text-gray-300 mt-0.5">
                  {hoveredCell.cell.count > 0
                    ? `${hoveredCell.cell.count} 次打卡 · ${(hoveredCell.cell.totalSeconds / 3600).toFixed(1)}h`
                    : '无打卡记录'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Team Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-12rem)]">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              团队概览
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="px-3 py-6 text-sm text-center text-gray-400">加载中...</div>
            ) : teamStats.length > 0 ? (
              teamStats.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 cursor-pointer"
                  onClick={() =>
                    navigate(`/members/${member.userId}/records`, {
                      state: { displayName: member.displayName, role: member.role }
                    })
                  }
                >
                  <Avatar
                    name={member.displayName}
                    size="md"
                    className="mr-3"
                    avatarColor={member.avatarColor}
                    avatarEmoji={member.avatarEmoji}
                    avatarBase64={member.avatarBase64}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{member.displayName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      周累计：{formatDuration(member.totalDurationSeconds)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                      {member.sessionsCount} 次
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-sm text-center text-gray-400">暂无团队统计</div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-800" onClick={() => navigate('/members')}>
              查看完整排行榜 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
