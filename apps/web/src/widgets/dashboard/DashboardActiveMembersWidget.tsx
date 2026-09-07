import { memo, useState } from 'react';
import { Activity, Clock3, Radio, Users } from 'lucide-react';
import { ATTENDANCE_MAX_SECONDS, type TeamActiveAttendanceItem } from '@lecpunch/shared';
import { Avatar, Badge } from '@lecpunch/ui';
import { useDashboardContext } from '@/features/dashboard/context/DashboardContext';
import { useSecondsTicker } from '@/shared/hooks/useSecondsTicker';
import { formatDateTime, formatDuration } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

const DashboardActiveMembersWidgetComponent = () => {
  const { loading, activeMembers, onOpenActiveMember } = useDashboardContext();
  const [, setTick] = useState(0);

  useSecondsTicker(() => {
    setTick((value) => value + 1);
  }, activeMembers.length > 0);

  const readElapsedSeconds = (member: TeamActiveAttendanceItem) =>
    Math.max(0, Math.floor((Date.now() - new Date(member.checkInAt).getTime()) / 1000));
  const displayedMembers = activeMembers.filter((member) => readElapsedSeconds(member) < ATTENDANCE_MAX_SECONDS);

  return (
    <PageSection className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900">当前打卡中成员</h3>
            <Badge variant={displayedMembers.length > 0 ? 'success' : 'gray'}>
              <Radio className="mr-1 h-3 w-3" />
              打卡状态
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="gray">
            <Users className="mr-1 h-3.5 w-3.5" />
            {displayedMembers.length} 人打卡中
          </Badge>
        </div>
      </div>

      <div className="p-6">
        {loading && displayedMembers.length === 0 ? (
          <PageState tone="loading" title="正在同步打卡状态..." className="px-0 py-10" />
        ) : displayedMembers.length === 0 ? (
          <PageState
            tone="empty"
            title="当前没有打卡中成员"
            description="成员上卡后，会显示在这里，直到下卡或达到五小时上限。"
            className="px-0 py-10"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {displayedMembers.map((member) => (
              <button
                key={member.memberKey}
                type="button"
                onClick={() => onOpenActiveMember(member)}
                className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={member.displayName}
                      size="md"
                      avatarColor={member.avatarColor}
                      avatarEmoji={member.avatarEmoji}
                      avatarBase64={member.avatarBase64}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{member.displayName}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span>{member.enrollYear ? `${member.enrollYear} 级` : '未标注年级'}</span>
                        <span>·</span>
                        <span>{member.weekKey}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant="success">打卡中</Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      开始打卡
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-gray-900">
                      {formatDateTime(member.checkInAt)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                      <Radio className="h-3.5 w-3.5" />
                      当前打卡时长
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-emerald-800">
                      {formatDuration(readElapsedSeconds(member))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm font-medium text-emerald-700">查看该成员流水</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageSection>
  );
};

export const DashboardActiveMembersWidget = memo(DashboardActiveMembersWidgetComponent);

DashboardActiveMembersWidget.displayName = 'DashboardActiveMembersWidget';
